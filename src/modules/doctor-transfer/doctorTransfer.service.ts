import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { DoctorTransferRepository } from "./doctorTransfer.repository";
import { AppointmentRepository } from "../appointment/appointment.repository";
import { WorkingHourDto } from "../employee/employee.types";
import {
    APPOINTMENT_STATUS,
    DAY_OF_WEEK_NAMES,
    NON_BLOCKING_APPOINTMENT_STATUSES
} from "../appointment/appointment.constants";
import {
    parseDateOnly,
    toDayOfWeek,
    timeStringToDate,
    timeToMinutes,
    formatTimeOfDay,
    timeStringToMinutes
} from "../appointment/appointment.utils";
import {
    TRANSFER_STATUS,
    TRANSFER_ACTION,
    TRANSFER_ACTION_VALUES,
    APPOINTMENT_LOG_RESULT,
    RESCHEDULE_QUEUE_STATUS,
    RESCHEDULE_QUEUE_ACTION,
    NOTIFICATION_CHANNEL_VALUES,
    DOCTOR_TRANSFER_CANCEL_REASON,
    TRANSFER_TRANSACTION_TIMEOUT_MS
} from "./doctorTransfer.constants";
import {
    InitiateTransferDto,
    ConfirmTransferDto,
    RescheduleQueueActionDto,
    GetRescheduleQueueQuery
} from "./doctorTransfer.types";

type ScheduleSnapshotEntry = WorkingHourDto & { consultation_minutes: number };

function todayDateOnly(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function formatDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
}

export class DoctorTransferService {

    private repository = new DoctorTransferRepository();
    private appointmentRepository = new AppointmentRepository();

    private async resolveDoctor(employeeId: string) {

        const employee = await this.repository.findDoctorWithRole(employeeId);

        if (!employee) {
            throw new Error("Doctor not found");
        }

        if (employee.user_table?.role_type !== "DOCTOR") {
            throw new Error("Selected employee is not a doctor");
        }

        if (employee.emp_status === false) {
            throw new Error("Doctor is inactive");
        }

        if (!employee.user_id) {
            throw new Error("Doctor has no linked login user");
        }

        return employee as typeof employee & { user_id: string };

    }

    private validateWorkingHours(workingHours: WorkingHourDto[], newBranchId: string) {

        if (!workingHours || workingHours.length === 0) {
            throw new Error("At least one working hour entry is required for the new branch");
        }

        for (const hour of workingHours) {

            if (hour.branch_id !== newBranchId) {
                throw new Error("All working hours must belong to the new branch");
            }

            if (!DAY_OF_WEEK_NAMES.includes(hour.day_of_week)) {
                throw new Error(`Invalid day_of_week: ${hour.day_of_week}`);
            }

            if (timeStringToMinutes(hour.start_time) >= timeStringToMinutes(hour.end_time)) {
                throw new Error("Working hour start_time must be before end_time");
            }

        }

    }

    private mapAppointmentSummary(appointment: {
        appointment_id: string;
        patient_id: string;
        branch_id: string | null;
        department_id: string | null;
        schedule_id: bigint | null;
        appointment_date: Date;
        appointment_time: Date;
        status: string | null;
        patient_bio_data?: {
            patient_first_name: string;
            patient_last_name: string | null;
            patient_primary_mobile: string | null;
        } | null;
    }) {

        return {
            appointment_id: appointment.appointment_id,
            patient_id: appointment.patient_id,
            patient_name: [
                appointment.patient_bio_data?.patient_first_name,
                appointment.patient_bio_data?.patient_last_name
            ].filter(Boolean).join(" "),
            patient_mobile: appointment.patient_bio_data?.patient_primary_mobile ?? null,
            branch_id: appointment.branch_id,
            department_id: appointment.department_id,
            schedule_id: appointment.schedule_id,
            appointment_date: formatDateOnly(appointment.appointment_date),
            appointment_time: formatTimeOfDay(appointment.appointment_time),
            status: appointment.status
        };

    }

    async previewFutureAppointments(employeeId: string, effectiveDateStr?: string) {

        await this.resolveDoctor(employeeId);

        const effectiveDate = effectiveDateStr ? parseDateOnly(effectiveDateStr) : todayDateOnly();

        const { appointments, total } = await this.repository.findFutureAppointments(
            employeeId,
            effectiveDate,
            1,
            200
        );

        return {
            employee_id: employeeId,
            effective_date: formatDateOnly(effectiveDate),
            affected_appointment_count: total,
            appointments: appointments.map((appointment) => this.mapAppointmentSummary(appointment))
        };

    }

    // Shared by both the "no future appointments" immediate-complete path in
    // initiateTransfer and the post-decision path in confirmTransfer. Never
    // updates an existing doctor_schedule/user_branch_mapping row - always
    // closes the old one and creates a new one.
    private async applyDoctorBranchMove(
        tx: Prisma.TransactionClient,
        params: {
            employee_id: string;
            employee_user_id: string;
            old_branch_id: string;
            new_branch_id: string;
            new_department_id: string | null;
            effective_date: Date;
            new_schedule: ScheduleSnapshotEntry[];
        }
    ) {

        const now = new Date();

        await this.repository.closeBranchMapping(tx, params.employee_id, params.old_branch_id, now);

        await this.repository.createBranchMapping(tx, {
            user_id: params.employee_user_id,
            branch_id: params.new_branch_id,
            employee_id: params.employee_id,
            status: 1,
            is_primary_branch: true,
            effective_from: params.effective_date,
            assigned_date: now
        });

        await this.repository.closeDoctorSchedules(tx, params.employee_id, params.old_branch_id, now);

        for (const schedule of params.new_schedule) {

            await this.repository.createDoctorSchedule(tx, {
                employee_id: params.employee_id,
                branch_id: schedule.branch_id,
                day_of_week: schedule.day_of_week,
                shift_name: schedule.shift_name,
                start_time: timeStringToDate(schedule.start_time),
                end_time: timeStringToDate(schedule.end_time),
                consultation_minutes: schedule.consultation_minutes,
                is_active: true,
                effective_from: params.effective_date
            });

        }

        await this.repository.updateEmployeeBranchDept(tx, params.employee_id, {
            branch_id: params.new_branch_id,
            ...(params.new_department_id ? { department_id: params.new_department_id } : {})
        });

    }

    async initiateTransfer(employeeId: string, dto: InitiateTransferDto, requestedBy: string) {

        const employee = await this.resolveDoctor(employeeId);

        const oldBranchId = dto.old_branch_id ?? employee.branch_id ?? undefined;

        if (!oldBranchId) {
            throw new Error("Doctor has no current branch assigned");
        }

        const oldMapping = await this.repository.findActiveBranchMapping(employeeId, oldBranchId);

        if (!oldMapping) {
            throw new Error(`Doctor is not currently active at branch ${oldBranchId}`);
        }

        if (!dto.new_branch_id) {
            throw new Error("New branch is required");
        }

        if (dto.new_branch_id === oldBranchId) {
            throw new Error("New branch must be different from the doctor's current branch");
        }

        const newBranch = await this.repository.findActiveBranch(dto.new_branch_id);

        if (!newBranch) {
            throw new Error("New branch not found or inactive");
        }

        const oldDepartmentId = employee.department_id ?? null;
        let newDepartmentId = oldDepartmentId;

        if (dto.new_department_id) {

            const department = await this.repository.findDepartment(dto.new_department_id);

            if (!department) {
                throw new Error("New department not found");
            }

            newDepartmentId = dto.new_department_id;

        }

        if (!dto.transfer_reason?.trim()) {
            throw new Error("Transfer reason is required");
        }

        if (!dto.effective_date) {
            throw new Error("Effective date is required");
        }

        const effectiveDate = parseDateOnly(dto.effective_date);

        if (effectiveDate.getTime() < todayDateOnly().getTime()) {
            throw new Error("Effective date cannot be in the past");
        }

        this.validateWorkingHours(dto.working_hours, dto.new_branch_id);

        const consultationMinutes = dto.consultation_minutes ?? 20;
        const scheduleSnapshot: ScheduleSnapshotEntry[] = dto.working_hours.map((hour) => ({
            ...hour,
            consultation_minutes: consultationMinutes
        }));

        const { total, appointments } = await this.repository.findFutureAppointments(employeeId, effectiveDate);

        if (total === 0) {

            const transfer = await prisma.$transaction(async (tx) => {

                const transferId = await this.repository.generateTransferId(tx);
                const now = new Date();

                await this.applyDoctorBranchMove(tx, {
                    employee_id: employeeId,
                    employee_user_id: employee.user_id,
                    old_branch_id: oldBranchId,
                    new_branch_id: dto.new_branch_id,
                    new_department_id: newDepartmentId,
                    effective_date: effectiveDate,
                    new_schedule: scheduleSnapshot
                });

                return this.repository.createDoctorTransfer(tx, {
                    transfer_id: transferId,
                    employee_id: employeeId,
                    old_branch_id: oldBranchId,
                    new_branch_id: dto.new_branch_id,
                    old_department_id: oldDepartmentId,
                    new_department_id: newDepartmentId,
                    effective_date: effectiveDate,
                    new_schedule: scheduleSnapshot as unknown as Prisma.InputJsonValue,
                    transfer_reason: dto.transfer_reason,
                    status: TRANSFER_STATUS.COMPLETED,
                    affected_appointment_count: 0,
                    requested_by: requestedBy,
                    confirmed_by: requestedBy,
                    confirmed_at: now,
                    completed_at: now
                });

            });

            return {
                transfer_id: transfer.transfer_id,
                status: transfer.status,
                message: "No future appointments were found for this doctor. The transfer was completed immediately.",
                affected_appointment_count: 0
            };

        }

        const transfer = await prisma.$transaction(async (tx) => {

            const transferId = await this.repository.generateTransferId(tx);

            return this.repository.createDoctorTransfer(tx, {
                transfer_id: transferId,
                employee_id: employeeId,
                old_branch_id: oldBranchId,
                new_branch_id: dto.new_branch_id,
                old_department_id: oldDepartmentId,
                new_department_id: newDepartmentId,
                effective_date: effectiveDate,
                new_schedule: scheduleSnapshot as unknown as Prisma.InputJsonValue,
                transfer_reason: dto.transfer_reason,
                status: TRANSFER_STATUS.PENDING_CONFIRMATION,
                affected_appointment_count: total,
                requested_by: requestedBy
            });

        });

        return {
            transfer_id: transfer.transfer_id,
            status: transfer.status,
            message: "Future appointments exist for this doctor. Administrator action is required to complete the transfer.",
            affected_appointment_count: total,
            appointments: appointments.map((appointment) => this.mapAppointmentSummary(appointment)),
            actions_required: TRANSFER_ACTION_VALUES
        };

    }

    private async transferSingleAppointment(
        tx: Prisma.TransactionClient,
        appointment: {
            appointment_id: string;
            appointment_date: Date;
            appointment_time: Date;
        },
        replacementEmployeeId: string,
        replacementEmployee: { first_name: string; last_name: string },
        targetBranchId: string
    ): Promise<{ success: boolean; scheduleId?: bigint; notes: string }> {

        const dayOfWeek = toDayOfWeek(appointment.appointment_date);

        const schedules = await tx.doctor_schedule.findMany({
            where: {
                employee_id: replacementEmployeeId,
                branch_id: targetBranchId,
                day_of_week: dayOfWeek,
                is_active: true
            }
        });

        const requestedMinutes = timeToMinutes(appointment.appointment_time);

        const match = schedules.find((schedule) => {

            if (!schedule.start_time || !schedule.end_time) {
                return false;
            }

            const start = timeToMinutes(schedule.start_time);
            const end = timeToMinutes(schedule.end_time);

            return requestedMinutes >= start && requestedMinutes < end;

        });

        if (!match) {
            return {
                success: false,
                notes: `Replacement doctor has no active schedule covering ${formatTimeOfDay(appointment.appointment_time)} on ${dayOfWeek}`
            };
        }

        const duplicate = await tx.appointment_history.findFirst({
            where: {
                employee_id: replacementEmployeeId,
                appointment_date: appointment.appointment_date,
                appointment_time: appointment.appointment_time,
                status: { notIn: NON_BLOCKING_APPOINTMENT_STATUSES },
                appointment_id: { not: appointment.appointment_id }
            }
        });

        if (duplicate) {
            return {
                success: false,
                notes: "Replacement doctor already has an appointment at this exact date and time"
            };
        }

        await this.appointmentRepository.lockDoctorSchedule(tx, match.schedule_id);

        const tokenNumber = await this.appointmentRepository.generateTokenNumber(
            tx,
            match.schedule_id,
            appointment.appointment_date
        );

        const doctorName = `${replacementEmployee.first_name} ${replacementEmployee.last_name}`.trim();

        await this.repository.updateAppointment(tx, appointment.appointment_id, {
            employee_id: replacementEmployeeId,
            branch_id: targetBranchId,
            schedule_id: match.schedule_id,
            token_number: tokenNumber,
            doctor_name: doctorName,
            assigned_doctor: doctorName
        });

        return { success: true, scheduleId: match.schedule_id, notes: "Reassigned to replacement doctor" };

    }

    async confirmTransfer(employeeId: string, dto: ConfirmTransferDto, confirmedBy: string) {

        if (!TRANSFER_ACTION_VALUES.includes(dto.action)) {
            throw new Error(`Action must be one of: ${TRANSFER_ACTION_VALUES.join(", ")}`);
        }

        if (!dto.transfer_id) {
            throw new Error("transfer_id is required");
        }

        const transfer = await this.repository.getDoctorTransferById(dto.transfer_id);

        if (!transfer) {
            throw new Error("Transfer request not found");
        }

        if (transfer.employee_id !== employeeId) {
            throw new Error("Transfer request does not belong to this doctor");
        }

        if (transfer.status !== TRANSFER_STATUS.PENDING_CONFIRMATION) {
            throw new Error(`Transfer has already been processed (status: ${transfer.status})`);
        }

        const employee = await this.resolveDoctor(employeeId);

        let replacementEmployee: { first_name: string; last_name: string; department_id: string | null } | null = null;
        let replacementTargetBranchId = "";

        if (dto.action === TRANSFER_ACTION.TRANSFER) {

            if (!dto.replacement_employee_id) {
                throw new Error("A replacement doctor is required for the TRANSFER action");
            }

            if (dto.replacement_employee_id === employeeId) {
                throw new Error("Replacement doctor must be different from the doctor being transferred");
            }

            const replacement = await this.repository.findDoctorWithRole(dto.replacement_employee_id);

            if (!replacement) {
                throw new Error("Replacement doctor not found");
            }

            if (replacement.user_table?.role_type !== "DOCTOR") {
                throw new Error("Replacement is not a doctor");
            }

            if (replacement.emp_status === false) {
                throw new Error("Replacement doctor is inactive");
            }

            replacementEmployee = replacement;
            replacementTargetBranchId = dto.replacement_branch_id ?? transfer.old_branch_id;

            const replacementMapping = await this.repository.findActiveBranchMapping(
                dto.replacement_employee_id,
                replacementTargetBranchId
            );

            if (!replacementMapping) {
                throw new Error("Replacement doctor is not actively assigned to the target branch");
            }

            if (transfer.old_department_id && replacement.department_id !== transfer.old_department_id) {
                throw new Error("Replacement doctor must belong to the same department as the doctor being transferred");
            }

            const replacementSchedules = await this.repository.findActiveDoctorSchedulesAtBranch(
                dto.replacement_employee_id,
                replacementTargetBranchId
            );

            if (replacementSchedules.length === 0) {
                throw new Error("Replacement doctor has no active schedule at the target branch");
            }

        } else if (dto.action === TRANSFER_ACTION.CANCEL) {

            if (dto.confirm !== true) {
                throw new Error("Explicit confirmation is required to bulk-cancel appointments");
            }

            if (dto.notify_channels?.some((channel) => !NOTIFICATION_CHANNEL_VALUES.includes(channel))) {
                throw new Error(`notify_channels must be one of: ${NOTIFICATION_CHANNEL_VALUES.join(", ")}`);
            }

        }

        const summary = { total: 0, successful: 0, conflicts: 0, queued: 0, cancelled: 0 };
        const conflicts: Array<{ appointment_id: string; reason: string }> = [];
        const successful: Array<{ appointment_id: string; reason: string }> = [];

        const updatedTransfer = await prisma.$transaction(async (tx) => {

            await this.repository.lockDoctorTransfer(tx, transfer.transfer_id);

            const appointments = await this.repository.findAllFutureAppointmentsForTransfer(
                tx,
                employeeId,
                transfer.effective_date
            );

            summary.total = appointments.length;

            for (const appointment of appointments) {

                await this.repository.lockAppointment(tx, appointment.appointment_id);

                if (dto.action === TRANSFER_ACTION.TRANSFER) {

                    const outcome = await this.transferSingleAppointment(
                        tx,
                        appointment,
                        dto.replacement_employee_id!,
                        replacementEmployee!,
                        replacementTargetBranchId
                    );

                    if (!outcome.success) {

                        await this.repository.updateAppointment(tx, appointment.appointment_id, {
                            status: APPOINTMENT_STATUS.TRANSFER_REVIEW_REQUIRED
                        });

                    }

                    await this.repository.createTransferAppointmentLog(tx, {
                        transfer_id: transfer.transfer_id,
                        appointment_id: appointment.appointment_id,
                        action: TRANSFER_ACTION.TRANSFER,
                        old_employee_id: employeeId,
                        old_branch_id: appointment.branch_id!,
                        old_schedule_id: appointment.schedule_id,
                        old_appointment_date: appointment.appointment_date,
                        old_appointment_time: appointment.appointment_time,
                        new_employee_id: outcome.success ? dto.replacement_employee_id : null,
                        new_branch_id: outcome.success ? replacementTargetBranchId : null,
                        new_schedule_id: outcome.success ? outcome.scheduleId : null,
                        result_status: outcome.success ? APPOINTMENT_LOG_RESULT.SUCCESS : APPOINTMENT_LOG_RESULT.CONFLICT,
                        notes: outcome.notes
                    });

                    if (outcome.success) {
                        summary.successful += 1;
                        successful.push({ appointment_id: appointment.appointment_id, reason: outcome.notes });
                    } else {
                        summary.conflicts += 1;
                        conflicts.push({ appointment_id: appointment.appointment_id, reason: outcome.notes });
                    }

                } else if (dto.action === TRANSFER_ACTION.RESCHEDULE) {

                    await this.repository.updateAppointment(tx, appointment.appointment_id, {
                        status: APPOINTMENT_STATUS.RESCHEDULE_REQUIRED
                    });

                    const queueId = await this.repository.generateQueueId(tx);

                    await this.repository.createRescheduleQueueEntry(tx, {
                        queue_id: queueId,
                        appointment_id: appointment.appointment_id,
                        patient_id: appointment.patient_id,
                        employee_id: employeeId,
                        branch_id: appointment.branch_id!,
                        department_id: appointment.department_id,
                        old_schedule_id: appointment.schedule_id,
                        old_appointment_date: appointment.appointment_date,
                        old_appointment_time: appointment.appointment_time,
                        transfer_id: transfer.transfer_id,
                        priority: dto.priority ?? "NORMAL",
                        reason: dto.reason ?? transfer.transfer_reason,
                        status: RESCHEDULE_QUEUE_STATUS.PENDING,
                        created_by: confirmedBy
                    });

                    await this.repository.createRescheduleActionLog(tx, {
                        queue_id: queueId,
                        action: RESCHEDULE_QUEUE_ACTION.CREATED,
                        performed_by: confirmedBy,
                        notes: `Created from doctor transfer ${transfer.transfer_id}`
                    });

                    await this.repository.createTransferAppointmentLog(tx, {
                        transfer_id: transfer.transfer_id,
                        appointment_id: appointment.appointment_id,
                        action: TRANSFER_ACTION.RESCHEDULE,
                        old_employee_id: employeeId,
                        old_branch_id: appointment.branch_id!,
                        old_schedule_id: appointment.schedule_id,
                        old_appointment_date: appointment.appointment_date,
                        old_appointment_time: appointment.appointment_time,
                        result_status: APPOINTMENT_LOG_RESULT.QUEUED,
                        notes: `Queued as ${queueId}`
                    });

                    summary.queued += 1;

                } else {

                    const now = new Date();
                    const notifyChannels = dto.notify_channels ?? [];

                    await this.repository.updateAppointment(tx, appointment.appointment_id, {
                        status: APPOINTMENT_STATUS.CANCELLED,
                        cancel_reason: DOCTOR_TRANSFER_CANCEL_REASON,
                        cancelled_by: confirmedBy,
                        cancelled_at: now,
                        notification_status: notifyChannels.length > 0 ? "PENDING" : "NOT_REQUIRED"
                    });

                    for (const channel of notifyChannels) {

                        const notificationId = await this.repository.generateNotificationId(tx);

                        await this.repository.createNotification(tx, {
                            notification_id: notificationId,
                            appointment_id: appointment.appointment_id,
                            channel,
                            notification_type: "DOCTOR_TRANSFER_CANCELLATION",
                            status: "PENDING"
                        });

                    }

                    await this.repository.createTransferAppointmentLog(tx, {
                        transfer_id: transfer.transfer_id,
                        appointment_id: appointment.appointment_id,
                        action: TRANSFER_ACTION.CANCEL,
                        old_employee_id: employeeId,
                        old_branch_id: appointment.branch_id!,
                        old_schedule_id: appointment.schedule_id,
                        old_appointment_date: appointment.appointment_date,
                        old_appointment_time: appointment.appointment_time,
                        result_status: APPOINTMENT_LOG_RESULT.CANCELLED,
                        notes: DOCTOR_TRANSFER_CANCEL_REASON
                    });

                    summary.cancelled += 1;

                }

            }

            await this.applyDoctorBranchMove(tx, {
                employee_id: employeeId,
                employee_user_id: employee.user_id,
                old_branch_id: transfer.old_branch_id,
                new_branch_id: transfer.new_branch_id,
                new_department_id: transfer.new_department_id,
                effective_date: transfer.effective_date,
                new_schedule: transfer.new_schedule as unknown as ScheduleSnapshotEntry[]
            });

            const now = new Date();

            return this.repository.updateDoctorTransfer(tx, transfer.transfer_id, {
                status: TRANSFER_STATUS.COMPLETED,
                action_taken: dto.action,
                replacement_employee_id: dto.action === TRANSFER_ACTION.TRANSFER ? dto.replacement_employee_id : null,
                confirmed_by: confirmedBy,
                confirmed_at: now,
                completed_at: now
            });

        }, { timeout: TRANSFER_TRANSACTION_TIMEOUT_MS });

        return {
            transfer_id: updatedTransfer.transfer_id,
            action: dto.action,
            status: updatedTransfer.status,
            summary,
            successful,
            conflicts
        };

    }

    async getRescheduleQueue(query: GetRescheduleQueueQuery) {

        return this.repository.getRescheduleQueue(query);

    }

    async processRescheduleQueueAction(appointmentId: string, dto: RescheduleQueueActionDto, performedBy: string) {

        const queue = await this.repository.findActiveRescheduleQueueForAppointment(appointmentId);

        if (!queue) {
            throw new Error("No pending reschedule request found for this appointment");
        }

        if (dto.action === "ASSIGN") {

            if (queue.status !== RESCHEDULE_QUEUE_STATUS.PENDING) {
                throw new Error(`Cannot assign a slot to a reschedule request that is already ${queue.status}`);
            }

            if (!dto.employee_id || !dto.branch_id || !dto.appointment_date || !dto.appointment_time) {
                throw new Error("employee_id, branch_id, appointment_date and appointment_time are required to assign a slot");
            }

            const employee = await this.repository.findDoctorWithRole(dto.employee_id);

            if (!employee) {
                throw new Error("Doctor not found");
            }

            if (employee.user_table?.role_type !== "DOCTOR") {
                throw new Error("Selected employee is not a doctor");
            }

            const branch = await this.repository.findActiveBranch(dto.branch_id);

            if (!branch) {
                throw new Error("Branch not found or inactive");
            }

            const mapping = await this.repository.findActiveBranchMapping(dto.employee_id, dto.branch_id);

            if (!mapping) {
                throw new Error("Doctor is not assigned to the selected branch");
            }

            const appointmentDate = parseDateOnly(dto.appointment_date);
            const dayOfWeek = toDayOfWeek(appointmentDate);

            const schedules = await this.appointmentRepository.findActiveDoctorSchedules(
                dto.employee_id,
                dto.branch_id,
                dayOfWeek
            );

            const requestedMinutes = timeStringToMinutes(dto.appointment_time);

            const schedule = schedules.find((s) => {

                if (!s.start_time || !s.end_time) {
                    return false;
                }

                return requestedMinutes >= timeToMinutes(s.start_time) && requestedMinutes < timeToMinutes(s.end_time);

            });

            if (!schedule) {
                throw new Error("Selected time is outside the doctor's working hours");
            }

            const appointmentTime = timeStringToDate(dto.appointment_time);

            const duplicate = await this.appointmentRepository.findDuplicateAppointment(
                dto.employee_id,
                appointmentDate,
                appointmentTime,
                appointmentId
            );

            if (duplicate) {
                throw new Error("Doctor already has an appointment at the selected date and time");
            }

            return prisma.$transaction(async (tx) => {

                await this.repository.lockRescheduleQueue(tx, queue.queue_id);

                await this.repository.updateRescheduleQueue(tx, queue.queue_id, {
                    status: RESCHEDULE_QUEUE_STATUS.ASSIGNED,
                    assigned_employee_id: dto.employee_id,
                    assigned_branch_id: dto.branch_id,
                    assigned_schedule_id: schedule.schedule_id,
                    assigned_date: appointmentDate,
                    assigned_time: appointmentTime
                });

                await this.repository.createRescheduleActionLog(tx, {
                    queue_id: queue.queue_id,
                    action: RESCHEDULE_QUEUE_ACTION.ASSIGNED,
                    performed_by: performedBy,
                    notes: dto.reason
                });

                return { queue_id: queue.queue_id, status: RESCHEDULE_QUEUE_STATUS.ASSIGNED };

            });

        }

        if (dto.action === "CONFIRM") {

            if (queue.status !== RESCHEDULE_QUEUE_STATUS.ASSIGNED) {
                throw new Error("A slot must be assigned before the reschedule can be confirmed");
            }

            return prisma.$transaction(async (tx) => {

                await this.repository.lockRescheduleQueue(tx, queue.queue_id);
                await this.appointmentRepository.lockDoctorSchedule(tx, queue.assigned_schedule_id!);

                const tokenNumber = await this.appointmentRepository.generateTokenNumber(
                    tx,
                    queue.assigned_schedule_id!,
                    queue.assigned_date!
                );

                const employee = await this.repository.findDoctorWithRole(queue.assigned_employee_id!);
                const doctorName = employee ? `${employee.first_name} ${employee.last_name}`.trim() : undefined;

                await this.repository.updateAppointment(tx, appointmentId, {
                    employee_id: queue.assigned_employee_id!,
                    branch_id: queue.assigned_branch_id!,
                    schedule_id: queue.assigned_schedule_id!,
                    appointment_date: queue.assigned_date!,
                    appointment_time: queue.assigned_time!,
                    token_number: tokenNumber,
                    status: APPOINTMENT_STATUS.RESCHEDULED,
                    ...(doctorName ? { doctor_name: doctorName, assigned_doctor: doctorName } : {})
                });

                await this.repository.updateRescheduleQueue(tx, queue.queue_id, {
                    status: RESCHEDULE_QUEUE_STATUS.CONFIRMED
                });

                await this.repository.createRescheduleActionLog(tx, {
                    queue_id: queue.queue_id,
                    action: RESCHEDULE_QUEUE_ACTION.CONFIRMED,
                    performed_by: performedBy,
                    notes: dto.reason
                });

                return { queue_id: queue.queue_id, status: RESCHEDULE_QUEUE_STATUS.CONFIRMED };

            });

        }

        // CANCEL
        return prisma.$transaction(async (tx) => {

            await this.repository.lockRescheduleQueue(tx, queue.queue_id);

            await this.repository.updateRescheduleQueue(tx, queue.queue_id, {
                status: RESCHEDULE_QUEUE_STATUS.CANCELLED
            });

            await this.repository.updateAppointment(tx, appointmentId, {
                status: APPOINTMENT_STATUS.CANCELLED,
                cancel_reason: DOCTOR_TRANSFER_CANCEL_REASON,
                cancelled_by: performedBy,
                cancelled_at: new Date()
            });

            await this.repository.createRescheduleActionLog(tx, {
                queue_id: queue.queue_id,
                action: RESCHEDULE_QUEUE_ACTION.CANCELLED,
                performed_by: performedBy,
                notes: dto.reason
            });

            return { queue_id: queue.queue_id, status: RESCHEDULE_QUEUE_STATUS.CANCELLED };

        });

    }

}
