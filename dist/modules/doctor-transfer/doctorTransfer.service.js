"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoctorTransferService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const doctorTransfer_repository_1 = require("./doctorTransfer.repository");
const appointment_repository_1 = require("../appointment/appointment.repository");
const appointment_constants_1 = require("../appointment/appointment.constants");
const appointment_utils_1 = require("../appointment/appointment.utils");
const doctorTransfer_constants_1 = require("./doctorTransfer.constants");
function todayDateOnly() {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}
function formatDateOnly(date) {
    return date.toISOString().slice(0, 10);
}
class DoctorTransferService {
    repository = new doctorTransfer_repository_1.DoctorTransferRepository();
    appointmentRepository = new appointment_repository_1.AppointmentRepository();
    async resolveDoctor(employeeId) {
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
        return employee;
    }
    validateWorkingHours(workingHours, newBranchId) {
        if (!workingHours || workingHours.length === 0) {
            throw new Error("At least one working hour entry is required for the new branch");
        }
        for (const hour of workingHours) {
            if (hour.branch_id !== newBranchId) {
                throw new Error("All working hours must belong to the new branch");
            }
            if (!appointment_constants_1.DAY_OF_WEEK_NAMES.includes(hour.day_of_week)) {
                throw new Error(`Invalid day_of_week: ${hour.day_of_week}`);
            }
            if ((0, appointment_utils_1.timeStringToMinutes)(hour.start_time) >= (0, appointment_utils_1.timeStringToMinutes)(hour.end_time)) {
                throw new Error("Working hour start_time must be before end_time");
            }
        }
    }
    mapAppointmentSummary(appointment) {
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
            appointment_time: (0, appointment_utils_1.formatTimeOfDay)(appointment.appointment_time),
            status: appointment.status
        };
    }
    async previewFutureAppointments(employeeId, effectiveDateStr) {
        await this.resolveDoctor(employeeId);
        const effectiveDate = effectiveDateStr ? (0, appointment_utils_1.parseDateOnly)(effectiveDateStr) : todayDateOnly();
        const { appointments, total } = await this.repository.findFutureAppointments(employeeId, effectiveDate, 1, 200);
        return {
            employee_id: employeeId,
            effective_date: formatDateOnly(effectiveDate),
            affected_appointment_count: total,
            appointments: appointments.map((appointment) => this.mapAppointmentSummary(appointment))
        };
    }
    // A doctor can be active at several branches at once, so this never
    // treats "assign to a new branch" as "leave the old one". It only closes
    // the SPECIFIC schedule rows that were found to conflict (by day/time)
    // with the newly requested hours - everything else the doctor already
    // has stays untouched. If closing those rows leaves a branch with zero
    // active schedules, that branch's mapping is closed too so the doctor
    // doesn't appear "assigned" somewhere they no longer have any hours.
    //
    // When old_branch_id is set (a true TRANSFER, not an add-branch), the
    // source branch is closed ENTIRELY on top of that: every remaining
    // active schedule at the old branch is deactivated and the source
    // mapping is flipped to status 0 unconditionally, so the doctor stops
    // appearing at that branch in every status-filtered read.
    async applyDoctorScheduleMove(tx, params) {
        const now = new Date();
        if (params.closing_schedule_ids.length > 0) {
            const closingSchedules = await this.repository.findSchedulesByIds(tx, params.closing_schedule_ids);
            await this.repository.closeSchedulesByIds(tx, params.closing_schedule_ids, now, params.deletedBy);
            const affectedBranchIds = Array.from(new Set(closingSchedules.map((s) => s.branch_id)));
            for (const branchId of affectedBranchIds) {
                if (branchId === params.new_branch_id) {
                    continue;
                }
                const remaining = await this.repository.countActiveSchedulesAtBranch(tx, params.employee_id, branchId);
                if (remaining === 0) {
                    await this.repository.closeBranchMapping(tx, params.employee_id, branchId, now, params.employee_user_id);
                }
            }
        }
        // True transfer: the doctor is leaving the source branch entirely -
        // close whatever schedules remain there (conflicting ones were
        // already closed above) and deactivate the source mapping (status 0).
        if (params.old_branch_id && params.old_branch_id !== params.new_branch_id) {
            await this.repository.closeSchedulesAtBranch(tx, params.employee_id, params.old_branch_id, now, params.deletedBy);
            await this.repository.closeBranchMapping(tx, params.employee_id, params.old_branch_id, now, params.employee_user_id);
        }
        const existingNewBranchMapping = await this.repository.findActiveBranchMapping(params.employee_id, params.new_branch_id, params.employee_user_id);
        if (!existingNewBranchMapping) {
            await this.repository.createBranchMapping(tx, {
                user_id: params.employee_user_id,
                branch_id: params.new_branch_id,
                employee_id: params.employee_id,
                status: 1,
                effective_from: params.effective_date,
                assigned_date: now
            });
        }
        for (const schedule of params.new_schedule) {
            await this.repository.createDoctorSchedule(tx, {
                employee_id: params.employee_id,
                branch_id: schedule.branch_id,
                day_of_week: schedule.day_of_week,
                shift_name: schedule.shift_name,
                start_time: (0, appointment_utils_1.timeStringToDate)(schedule.start_time),
                end_time: (0, appointment_utils_1.timeStringToDate)(schedule.end_time),
                consultation_minutes: schedule.consultation_minutes,
                is_active: true,
                effective_from: params.effective_date
            });
        }
        // Only bootstraps the doctor's primary branch/department pointer the
        // first time they're ever assigned anywhere - an existing primary
        // branch is never overwritten just because a new branch was added.
        if (!params.employee_branch_id) {
            await this.repository.updateEmployeeBranchDept(tx, params.employee_id, {
                branch_id: params.new_branch_id,
                ...(params.new_department_id ? { department_id: params.new_department_id } : {})
            });
        }
    }
    timeRangesOverlap(aStart, aEnd, bStart, bEnd) {
        return (0, appointment_utils_1.timeToMinutes)(aStart) < (0, appointment_utils_1.timeToMinutes)(bEnd) && (0, appointment_utils_1.timeToMinutes)(bStart) < (0, appointment_utils_1.timeToMinutes)(aEnd);
    }
    // Any of the doctor's OTHER currently-active schedules (any branch,
    // including the new branch itself) that overlap in day/time with a
    // newly requested slot must be closed before the new slot can exist -
    // a doctor can't be scheduled in two places at once.
    findConflictingSchedules(activeSchedules, workingHours) {
        const conflicts = new Map();
        for (const hour of workingHours) {
            const newStart = (0, appointment_utils_1.timeStringToDate)(hour.start_time);
            const newEnd = (0, appointment_utils_1.timeStringToDate)(hour.end_time);
            for (const schedule of activeSchedules) {
                if (schedule.day_of_week !== hour.day_of_week) {
                    continue;
                }
                if (!schedule.start_time || !schedule.end_time) {
                    continue;
                }
                if (this.timeRangesOverlap(schedule.start_time, schedule.end_time, newStart, newEnd)) {
                    conflicts.set(schedule.schedule_id.toString(), schedule);
                }
            }
        }
        return Array.from(conflicts.values());
    }
    async findEligibleReplacementDoctors(branchId, departmentId, excludeEmployeeId, dayOfWeek, appointmentTime) {
        if (!departmentId) {
            return [];
        }
        const candidates = await this.repository.findEligibleReplacementCandidates(branchId, departmentId, excludeEmployeeId, dayOfWeek);
        const requestedMinutes = (0, appointment_utils_1.timeToMinutes)(appointmentTime);
        const eligible = new Map();
        for (const schedule of candidates) {
            if (!schedule.start_time || !schedule.end_time) {
                continue;
            }
            const withinSlot = requestedMinutes >= (0, appointment_utils_1.timeToMinutes)(schedule.start_time) &&
                requestedMinutes < (0, appointment_utils_1.timeToMinutes)(schedule.end_time);
            if (withinSlot && schedule.employees) {
                eligible.set(schedule.employees.employee_id, {
                    employee_id: schedule.employees.employee_id,
                    name: `${schedule.employees.first_name} ${schedule.employees.last_name}`.trim()
                });
            }
        }
        return Array.from(eligible.values());
    }
    async initiateTransfer(employeeId, dto, requestedBy) {
        const employee = await this.resolveDoctor(employeeId);
        const mode = dto.mode ?? "ADD_BRANCH";
        if (!dto.new_branch_id) {
            throw new Error("New branch is required");
        }
        let oldBranchId = null;
        if (mode === "TRANSFER") {
            // Rule: a transfer must always have a real FROM branch - "None"
            // is not a valid source. Leaving no source is the Add Branch
            // operation (mode === "ADD_BRANCH"), never a transfer.
            if (!dto.old_branch_id) {
                throw new Error("From branch is required for a transfer");
            }
            oldBranchId = dto.old_branch_id;
            if (oldBranchId === dto.new_branch_id) {
                throw new Error("From and To branches must be different");
            }
            // The source must be one of the doctor's ACTIVE assignments
            // (user_branch_mapping status 1) - you can't transfer a doctor
            // away from a branch they aren't currently on.
            const sourceMapping = await this.repository.findActiveBranchMapping(employeeId, oldBranchId, employee.user_id);
            if (!sourceMapping) {
                throw new Error("Doctor is not assigned to the source branch");
            }
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
        const effectiveDate = (0, appointment_utils_1.parseDateOnly)(dto.effective_date);
        if (effectiveDate.getTime() < todayDateOnly().getTime()) {
            throw new Error("Effective date cannot be in the past");
        }
        this.validateWorkingHours(dto.working_hours, dto.new_branch_id);
        const consultationMinutes = dto.consultation_minutes ?? 20;
        const scheduleSnapshot = dto.working_hours.map((hour) => ({
            ...hour,
            consultation_minutes: consultationMinutes
        }));
        // Conflicts are computed against EVERY branch the doctor is
        // currently active at (including new_branch_id itself, if they're
        // already there) - not a single "old branch". Only schedule rows
        // that actually overlap the requested hours are ever touched.
        const activeSchedules = await this.repository.findAllActiveSchedules(employeeId);
        const conflictingSchedules = this.findConflictingSchedules(activeSchedules, dto.working_hours);
        const closingScheduleIds = conflictingSchedules.map((s) => s.schedule_id);
        // A TRANSFER also closes every schedule the doctor still has at the
        // source branch - they are leaving that branch entirely, not just
        // the slots that clash with the new hours. Those schedules' future
        // appointments flow through the same preview/confirm protection
        // as conflicting ones.
        if (mode === "TRANSFER" && oldBranchId) {
            for (const schedule of activeSchedules) {
                if (schedule.branch_id === oldBranchId &&
                    !closingScheduleIds.includes(schedule.schedule_id)) {
                    closingScheduleIds.push(schedule.schedule_id);
                }
            }
        }
        const completeImmediately = async (affectedCount) => prisma_1.default.$transaction(async (tx) => {
            const transferId = await this.repository.generateTransferId(tx);
            const now = new Date();
            await this.applyDoctorScheduleMove(tx, {
                employee_id: employeeId,
                employee_user_id: employee.user_id,
                employee_branch_id: employee.branch_id,
                old_branch_id: oldBranchId,
                new_branch_id: dto.new_branch_id,
                new_department_id: newDepartmentId,
                effective_date: effectiveDate,
                new_schedule: scheduleSnapshot,
                closing_schedule_ids: closingScheduleIds,
                deletedBy: mode === "TRANSFER" ? requestedBy : null
            });
            return this.repository.createDoctorTransfer(tx, {
                transfer_id: transferId,
                employee_id: employeeId,
                new_branch_id: dto.new_branch_id,
                old_department_id: oldDepartmentId,
                new_department_id: newDepartmentId,
                effective_date: effectiveDate,
                new_schedule: scheduleSnapshot,
                closing_schedule_ids: closingScheduleIds,
                transfer_reason: dto.transfer_reason,
                status: doctorTransfer_constants_1.TRANSFER_STATUS.COMPLETED,
                affected_appointment_count: affectedCount,
                requested_by: requestedBy,
                confirmed_by: requestedBy,
                confirmed_at: now,
                completed_at: now
            });
        });
        if (closingScheduleIds.length === 0) {
            const transfer = await completeImmediately(0);
            return {
                transfer_id: transfer.transfer_id,
                status: transfer.status,
                message: "No conflicting schedule found. The doctor was assigned to the new branch immediately.",
                affected_appointment_count: 0
            };
        }
        const { total, appointments } = await this.repository.findFutureAppointmentsByScheduleIds(closingScheduleIds, effectiveDate);
        if (total === 0) {
            const transfer = await completeImmediately(0);
            return {
                transfer_id: transfer.transfer_id,
                status: transfer.status,
                message: `${closingScheduleIds.length} conflicting schedule slot(s) were closed and the doctor was assigned to the new branch immediately (no future appointments were affected).`,
                affected_appointment_count: 0
            };
        }
        const transfer = await prisma_1.default.$transaction(async (tx) => {
            const transferId = await this.repository.generateTransferId(tx);
            return this.repository.createDoctorTransfer(tx, {
                transfer_id: transferId,
                employee_id: employeeId,
                new_branch_id: dto.new_branch_id,
                old_department_id: oldDepartmentId,
                new_department_id: newDepartmentId,
                effective_date: effectiveDate,
                new_schedule: scheduleSnapshot,
                closing_schedule_ids: closingScheduleIds,
                transfer_reason: dto.transfer_reason,
                status: doctorTransfer_constants_1.TRANSFER_STATUS.PENDING_CONFIRMATION,
                affected_appointment_count: total,
                requested_by: requestedBy
            });
        });
        const appointmentsWithCandidates = await Promise.all(appointments.map(async (appointment) => ({
            ...this.mapAppointmentSummary(appointment),
            eligible_replacement_doctors: await this.findEligibleReplacementDoctors(appointment.branch_id, oldDepartmentId, employeeId, (0, appointment_utils_1.toDayOfWeek)(appointment.appointment_date), appointment.appointment_time)
        })));
        return {
            transfer_id: transfer.transfer_id,
            status: transfer.status,
            message: `${closingScheduleIds.length} conflicting schedule slot(s) have ${total} future appointment(s). Administrator action is required.`,
            affected_appointment_count: total,
            appointments: appointmentsWithCandidates,
            actions_required: doctorTransfer_constants_1.TRANSFER_ACTION_VALUES
        };
    }
    async transferSingleAppointment(tx, appointment, replacementEmployeeId, replacementEmployee, replacementUserId, targetBranchId) {
        const dayOfWeek = (0, appointment_utils_1.toDayOfWeek)(appointment.appointment_date);
        // The replacement must be ACTIVELY assigned to the target branch
        // (user_branch_mapping status 1) — a schedule alone is not an
        // assignment; only mapped doctors can take over appointments there.
        const targetMapping = await this.repository.findActiveBranchMapping(replacementEmployeeId, targetBranchId, replacementUserId);
        if (!targetMapping) {
            return {
                success: false,
                notes: `Replacement doctor is not assigned to branch ${targetBranchId}`
            };
        }
        const schedules = await tx.doctor_schedule.findMany({
            where: {
                employee_id: replacementEmployeeId,
                branch_id: targetBranchId,
                day_of_week: dayOfWeek,
                is_active: true
            }
        });
        const requestedMinutes = (0, appointment_utils_1.timeToMinutes)(appointment.appointment_time);
        const match = schedules.find((schedule) => {
            if (!schedule.start_time || !schedule.end_time) {
                return false;
            }
            const start = (0, appointment_utils_1.timeToMinutes)(schedule.start_time);
            const end = (0, appointment_utils_1.timeToMinutes)(schedule.end_time);
            return requestedMinutes >= start && requestedMinutes < end;
        });
        if (!match) {
            return {
                success: false,
                notes: `Replacement doctor has no active schedule covering ${(0, appointment_utils_1.formatTimeOfDay)(appointment.appointment_time)} on ${dayOfWeek}`
            };
        }
        const duplicate = await tx.appointment_history.findFirst({
            where: {
                employee_id: replacementEmployeeId,
                appointment_date: appointment.appointment_date,
                appointment_time: appointment.appointment_time,
                status: { notIn: appointment_constants_1.NON_BLOCKING_APPOINTMENT_STATUSES },
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
        const tokenNumber = await this.appointmentRepository.generateTokenNumber(tx, match.schedule_id, appointment.appointment_date);
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
    async confirmTransfer(employeeId, dto, confirmedBy) {
        if (!doctorTransfer_constants_1.TRANSFER_ACTION_VALUES.includes(dto.action)) {
            throw new Error(`Action must be one of: ${doctorTransfer_constants_1.TRANSFER_ACTION_VALUES.join(", ")}`);
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
        if (transfer.status !== doctorTransfer_constants_1.TRANSFER_STATUS.PENDING_CONFIRMATION) {
            throw new Error(`Transfer has already been processed (status: ${transfer.status})`);
        }
        // The source branch travels with the confirm payload (no schema
        // change) so the pending path can close it exactly like the
        // immediate-complete path does at initiate time.
        if (dto.old_branch_id && transfer.new_branch_id === dto.old_branch_id) {
            throw new Error("From and To branches must be different");
        }
        const employee = await this.resolveDoctor(employeeId);
        let replacementEmployee = null;
        if (dto.action === doctorTransfer_constants_1.TRANSFER_ACTION.TRANSFER) {
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
            if (transfer.old_department_id && replacement.department_id !== transfer.old_department_id) {
                throw new Error("Replacement doctor must belong to the same department as the doctor being transferred");
            }
            // Eligibility per exact appointment (branch/day/time) is checked
            // inside the transaction loop below, since conflicts can span
            // several branches - there's no single "target branch" to gate
            // on upfront.
            replacementEmployee = replacement;
        }
        else if (dto.action === doctorTransfer_constants_1.TRANSFER_ACTION.CANCEL) {
            if (dto.confirm !== true) {
                throw new Error("Explicit confirmation is required to bulk-cancel appointments");
            }
            if (dto.notify_channels?.some((channel) => !doctorTransfer_constants_1.NOTIFICATION_CHANNEL_VALUES.includes(channel))) {
                throw new Error(`notify_channels must be one of: ${doctorTransfer_constants_1.NOTIFICATION_CHANNEL_VALUES.join(", ")}`);
            }
        }
        const summary = { total: 0, successful: 0, conflicts: 0, queued: 0, cancelled: 0 };
        const conflicts = [];
        const successful = [];
        const updatedTransfer = await prisma_1.default.$transaction(async (tx) => {
            await this.repository.lockDoctorTransfer(tx, transfer.transfer_id);
            const appointments = await this.repository.findAllFutureAppointmentsForTransferByScheduleIds(tx, transfer.closing_schedule_ids, transfer.effective_date);
            summary.total = appointments.length;
            for (const appointment of appointments) {
                await this.repository.lockAppointment(tx, appointment.appointment_id);
                if (dto.action === doctorTransfer_constants_1.TRANSFER_ACTION.TRANSFER) {
                    // Defaults to the appointment's OWN branch - that's
                    // physically where the patient is booked - unless the
                    // admin explicitly wants to relocate everyone to a
                    // different branch via replacement_branch_id.
                    const targetBranchId = dto.replacement_branch_id ?? appointment.branch_id;
                    const outcome = await this.transferSingleAppointment(tx, appointment, dto.replacement_employee_id, replacementEmployee, replacementEmployee.user_id, targetBranchId);
                    if (!outcome.success) {
                        await this.repository.updateAppointment(tx, appointment.appointment_id, {
                            status: appointment_constants_1.APPOINTMENT_STATUS.TRANSFER_REVIEW_REQUIRED
                        });
                    }
                    await this.repository.createTransferAppointmentLog(tx, {
                        transfer_id: transfer.transfer_id,
                        appointment_id: appointment.appointment_id,
                        action: doctorTransfer_constants_1.TRANSFER_ACTION.TRANSFER,
                        old_employee_id: employeeId,
                        old_branch_id: appointment.branch_id,
                        old_schedule_id: appointment.schedule_id,
                        old_appointment_date: appointment.appointment_date,
                        old_appointment_time: appointment.appointment_time,
                        new_employee_id: outcome.success ? dto.replacement_employee_id : null,
                        new_branch_id: outcome.success ? targetBranchId : null,
                        new_schedule_id: outcome.success ? outcome.scheduleId : null,
                        result_status: outcome.success ? doctorTransfer_constants_1.APPOINTMENT_LOG_RESULT.SUCCESS : doctorTransfer_constants_1.APPOINTMENT_LOG_RESULT.CONFLICT,
                        notes: outcome.notes
                    });
                    if (outcome.success) {
                        summary.successful += 1;
                        successful.push({ appointment_id: appointment.appointment_id, reason: outcome.notes });
                    }
                    else {
                        summary.conflicts += 1;
                        conflicts.push({ appointment_id: appointment.appointment_id, reason: outcome.notes });
                    }
                }
                else if (dto.action === doctorTransfer_constants_1.TRANSFER_ACTION.RESCHEDULE) {
                    await this.repository.updateAppointment(tx, appointment.appointment_id, {
                        status: appointment_constants_1.APPOINTMENT_STATUS.RESCHEDULE_REQUIRED
                    });
                    const queueId = await this.repository.generateQueueId(tx);
                    await this.repository.createRescheduleQueueEntry(tx, {
                        queue_id: queueId,
                        appointment_id: appointment.appointment_id,
                        patient_id: appointment.patient_id,
                        employee_id: employeeId,
                        branch_id: appointment.branch_id,
                        department_id: appointment.department_id,
                        old_schedule_id: appointment.schedule_id,
                        old_appointment_date: appointment.appointment_date,
                        old_appointment_time: appointment.appointment_time,
                        transfer_id: transfer.transfer_id,
                        priority: dto.priority ?? "NORMAL",
                        reason: dto.reason ?? transfer.transfer_reason,
                        status: doctorTransfer_constants_1.RESCHEDULE_QUEUE_STATUS.PENDING,
                        created_by: confirmedBy
                    });
                    await this.repository.createRescheduleActionLog(tx, {
                        queue_id: queueId,
                        action: doctorTransfer_constants_1.RESCHEDULE_QUEUE_ACTION.CREATED,
                        performed_by: confirmedBy,
                        notes: `Created from doctor transfer ${transfer.transfer_id}`
                    });
                    await this.repository.createTransferAppointmentLog(tx, {
                        transfer_id: transfer.transfer_id,
                        appointment_id: appointment.appointment_id,
                        action: doctorTransfer_constants_1.TRANSFER_ACTION.RESCHEDULE,
                        old_employee_id: employeeId,
                        old_branch_id: appointment.branch_id,
                        old_schedule_id: appointment.schedule_id,
                        old_appointment_date: appointment.appointment_date,
                        old_appointment_time: appointment.appointment_time,
                        result_status: doctorTransfer_constants_1.APPOINTMENT_LOG_RESULT.QUEUED,
                        notes: `Queued as ${queueId}`
                    });
                    summary.queued += 1;
                }
                else {
                    const now = new Date();
                    const notifyChannels = dto.notify_channels ?? [];
                    await this.repository.updateAppointment(tx, appointment.appointment_id, {
                        status: appointment_constants_1.APPOINTMENT_STATUS.CANCELLED,
                        cancel_reason: doctorTransfer_constants_1.DOCTOR_TRANSFER_CANCEL_REASON,
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
                        action: doctorTransfer_constants_1.TRANSFER_ACTION.CANCEL,
                        old_employee_id: employeeId,
                        old_branch_id: appointment.branch_id,
                        old_schedule_id: appointment.schedule_id,
                        old_appointment_date: appointment.appointment_date,
                        old_appointment_time: appointment.appointment_time,
                        result_status: doctorTransfer_constants_1.APPOINTMENT_LOG_RESULT.CANCELLED,
                        notes: doctorTransfer_constants_1.DOCTOR_TRANSFER_CANCEL_REASON
                    });
                    summary.cancelled += 1;
                }
            }
            await this.applyDoctorScheduleMove(tx, {
                employee_id: employeeId,
                employee_user_id: employee.user_id,
                employee_branch_id: employee.branch_id,
                old_branch_id: dto.old_branch_id ?? null,
                new_branch_id: transfer.new_branch_id,
                new_department_id: transfer.new_department_id,
                effective_date: transfer.effective_date,
                new_schedule: transfer.new_schedule,
                closing_schedule_ids: transfer.closing_schedule_ids,
                deletedBy: dto.action === doctorTransfer_constants_1.TRANSFER_ACTION.TRANSFER ? confirmedBy : null
            });
            const now = new Date();
            return this.repository.updateDoctorTransfer(tx, transfer.transfer_id, {
                status: doctorTransfer_constants_1.TRANSFER_STATUS.COMPLETED,
                action_taken: dto.action,
                replacement_employee_id: dto.action === doctorTransfer_constants_1.TRANSFER_ACTION.TRANSFER ? dto.replacement_employee_id : null,
                confirmed_by: confirmedBy,
                confirmed_at: now,
                completed_at: now
            });
        }, { timeout: doctorTransfer_constants_1.TRANSFER_TRANSACTION_TIMEOUT_MS });
        return {
            transfer_id: updatedTransfer.transfer_id,
            action: dto.action,
            status: updatedTransfer.status,
            summary,
            successful,
            conflicts
        };
    }
    async getRescheduleQueue(query) {
        return this.repository.getRescheduleQueue(query);
    }
    async processRescheduleQueueAction(appointmentId, dto, performedBy) {
        const queue = await this.repository.findActiveRescheduleQueueForAppointment(appointmentId);
        if (!queue) {
            throw new Error("No pending reschedule request found for this appointment");
        }
        if (dto.action === "ASSIGN") {
            if (queue.status !== doctorTransfer_constants_1.RESCHEDULE_QUEUE_STATUS.PENDING) {
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
            const mapping = await this.repository.findActiveBranchMapping(dto.employee_id, dto.branch_id, employee.user_id);
            if (!mapping) {
                throw new Error("Doctor is not assigned to the selected branch");
            }
            const appointmentDate = (0, appointment_utils_1.parseDateOnly)(dto.appointment_date);
            const dayOfWeek = (0, appointment_utils_1.toDayOfWeek)(appointmentDate);
            const schedules = await this.appointmentRepository.findActiveDoctorSchedules(dto.employee_id, dto.branch_id, dayOfWeek);
            const requestedMinutes = (0, appointment_utils_1.timeStringToMinutes)(dto.appointment_time);
            const schedule = schedules.find((s) => {
                if (!s.start_time || !s.end_time) {
                    return false;
                }
                return requestedMinutes >= (0, appointment_utils_1.timeToMinutes)(s.start_time) && requestedMinutes < (0, appointment_utils_1.timeToMinutes)(s.end_time);
            });
            if (!schedule) {
                throw new Error("Selected time is outside the doctor's working hours");
            }
            const appointmentTime = (0, appointment_utils_1.timeStringToDate)(dto.appointment_time);
            const duplicate = await this.appointmentRepository.findDuplicateAppointment(dto.employee_id, appointmentDate, appointmentTime, appointmentId);
            if (duplicate) {
                throw new Error("Doctor already has an appointment at the selected date and time");
            }
            return prisma_1.default.$transaction(async (tx) => {
                await this.repository.lockRescheduleQueue(tx, queue.queue_id);
                await this.repository.updateRescheduleQueue(tx, queue.queue_id, {
                    status: doctorTransfer_constants_1.RESCHEDULE_QUEUE_STATUS.ASSIGNED,
                    assigned_employee_id: dto.employee_id,
                    assigned_branch_id: dto.branch_id,
                    assigned_schedule_id: schedule.schedule_id,
                    assigned_date: appointmentDate,
                    assigned_time: appointmentTime
                });
                await this.repository.createRescheduleActionLog(tx, {
                    queue_id: queue.queue_id,
                    action: doctorTransfer_constants_1.RESCHEDULE_QUEUE_ACTION.ASSIGNED,
                    performed_by: performedBy,
                    notes: dto.reason
                });
                return { queue_id: queue.queue_id, status: doctorTransfer_constants_1.RESCHEDULE_QUEUE_STATUS.ASSIGNED };
            });
        }
        if (dto.action === "CONFIRM") {
            if (queue.status !== doctorTransfer_constants_1.RESCHEDULE_QUEUE_STATUS.ASSIGNED) {
                throw new Error("A slot must be assigned before the reschedule can be confirmed");
            }
            return prisma_1.default.$transaction(async (tx) => {
                await this.repository.lockRescheduleQueue(tx, queue.queue_id);
                await this.appointmentRepository.lockDoctorSchedule(tx, queue.assigned_schedule_id);
                const tokenNumber = await this.appointmentRepository.generateTokenNumber(tx, queue.assigned_schedule_id, queue.assigned_date);
                const employee = await this.repository.findDoctorWithRole(queue.assigned_employee_id);
                const doctorName = employee ? `${employee.first_name} ${employee.last_name}`.trim() : undefined;
                await this.repository.updateAppointment(tx, appointmentId, {
                    employee_id: queue.assigned_employee_id,
                    branch_id: queue.assigned_branch_id,
                    schedule_id: queue.assigned_schedule_id,
                    appointment_date: queue.assigned_date,
                    appointment_time: queue.assigned_time,
                    token_number: tokenNumber,
                    status: appointment_constants_1.APPOINTMENT_STATUS.RESCHEDULED,
                    ...(doctorName ? { doctor_name: doctorName, assigned_doctor: doctorName } : {})
                });
                await this.repository.updateRescheduleQueue(tx, queue.queue_id, {
                    status: doctorTransfer_constants_1.RESCHEDULE_QUEUE_STATUS.CONFIRMED
                });
                await this.repository.createRescheduleActionLog(tx, {
                    queue_id: queue.queue_id,
                    action: doctorTransfer_constants_1.RESCHEDULE_QUEUE_ACTION.CONFIRMED,
                    performed_by: performedBy,
                    notes: dto.reason
                });
                return { queue_id: queue.queue_id, status: doctorTransfer_constants_1.RESCHEDULE_QUEUE_STATUS.CONFIRMED };
            });
        }
        // CANCEL
        return prisma_1.default.$transaction(async (tx) => {
            await this.repository.lockRescheduleQueue(tx, queue.queue_id);
            await this.repository.updateRescheduleQueue(tx, queue.queue_id, {
                status: doctorTransfer_constants_1.RESCHEDULE_QUEUE_STATUS.CANCELLED
            });
            await this.repository.updateAppointment(tx, appointmentId, {
                status: appointment_constants_1.APPOINTMENT_STATUS.CANCELLED,
                cancel_reason: doctorTransfer_constants_1.DOCTOR_TRANSFER_CANCEL_REASON,
                cancelled_by: performedBy,
                cancelled_at: new Date()
            });
            await this.repository.createRescheduleActionLog(tx, {
                queue_id: queue.queue_id,
                action: doctorTransfer_constants_1.RESCHEDULE_QUEUE_ACTION.CANCELLED,
                performed_by: performedBy,
                notes: dto.reason
            });
            return { queue_id: queue.queue_id, status: doctorTransfer_constants_1.RESCHEDULE_QUEUE_STATUS.CANCELLED };
        });
    }
}
exports.DoctorTransferService = DoctorTransferService;
