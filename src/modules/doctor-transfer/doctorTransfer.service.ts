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
    GetRescheduleQueueQuery,
    ScheduleChangeRequestDto
} from "./doctorTransfer.types";
import { DoctorScheduleService } from "../doctor-schedule/doctorSchedule.service";

type ScheduleSnapshotEntry = WorkingHourDto & { consultation_minutes: number };

function todayDateOnly(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function formatDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function normalizeDayOfWeek(day: string): WorkingHourDto["day_of_week"] {
    return day.trim().toUpperCase() as WorkingHourDto["day_of_week"];
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

            hour.day_of_week = normalizeDayOfWeek(hour.day_of_week);

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
private async applySlotMove(
        tx: Prisma.TransactionClient,
        params: {
            employee_id: string;
            employee_user_id: string;
            employee_branch_id: string | null;
            old_branch_id: string | null; // will be null for slot‑move
            new_branch_id: string;
            new_department_id: string | null;
            effective_date: Date;
            new_schedule: ScheduleSnapshotEntry[];
            closing_schedule_ids: bigint[];
            deletedBy?: string | null;
        }
    ) {

        const now = new Date();

        const closedBranchIds: string[] = [];

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
                    closedBranchIds.push(branchId);
                }

            }

        }

        // NOTE: No source‑branch closure here – this is only a slot‑move / ADD_BRANCH.

        const existingNewBranchMapping = await this.repository.findActiveBranchMapping(
            params.employee_id,
            params.new_branch_id,
            params.employee_user_id
        );

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
                day_of_week: normalizeDayOfWeek(schedule.day_of_week),
                shift_name: schedule.shift_name,
                start_time: timeStringToDate(schedule.start_time),
                end_time: timeStringToDate(schedule.end_time),
                consultation_minutes: schedule.consultation_minutes,
                is_active: true,
                effective_from: params.effective_date
            });

        }

        // Only bootstrap the doctor's primary branch/department pointer the
        // first time they're ever assigned anywhere – an existing primary
        // branch is never overwritten just because a new branch was added.
        if (!params.employee_branch_id) {

            await this.repository.updateEmployeeBranchDept(tx, params.employee_id, {
                branch_id: params.new_branch_id,
                ...(params.new_department_id ? { department_id: params.new_department_id } : {})
            });

        }

        return closedBranchIds;

    }

    private async applyDoctorTransfer(
        tx: Prisma.TransactionClient,
        params: {
            employee_id: string;
            employee_user_id: string;
            employee_branch_id: string | null;
            old_branch_id: string | null;
            new_branch_id: string;
            new_department_id: string | null;
            effective_date: Date;
            new_schedule: ScheduleSnapshotEntry[];
            closing_schedule_ids: bigint[];
            deletedBy?: string | null;
        }
    ) {
        // Reuse the slot‑move logic for schedule creation / conflict cleanup
        const closedBranchIds = await this.applySlotMove(tx, params);

        // True transfer: close ALL remaining schedules at the source branch and
        // deactivate the mapping.
        if (params.old_branch_id && params.old_branch_id !== params.new_branch_id) {
            await this.repository.closeSchedulesAtBranch(tx, params.employee_id, params.old_branch_id, new Date(), params.deletedBy);
            await this.repository.closeBranchMapping(tx, params.employee_id, params.old_branch_id, new Date(), params.employee_user_id);
            if (!closedBranchIds.includes(params.old_branch_id)) {
                closedBranchIds.push(params.old_branch_id);
            }
        }
        return closedBranchIds;
    }

    private timeRangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {

        return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(bStart) < timeToMinutes(aEnd);

    }

    // Any of the doctor's OTHER currently-active schedules (any branch,
    // including the new branch itself) that overlap in day/time with a
    // newly requested slot must be closed before the new slot can exist -
    // a doctor can't be scheduled in two places at once.
    private findConflictingSchedules(
        activeSchedules: Array<{ schedule_id: bigint; branch_id: string; day_of_week: string | null; start_time: Date | null; end_time: Date | null }>,
        workingHours: WorkingHourDto[]
    ) {

        const conflicts = new Map<string, typeof activeSchedules[number]>();

        for (const hour of workingHours) {

            const newStart = timeStringToDate(hour.start_time);
            const newEnd = timeStringToDate(hour.end_time);

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

    // ==================================================================
    // DATE_CHANGE transfers - ADD / OVERRIDE / CANCEL on one exact date,
    // protected like recurring slots: affected appointments are detected
    // and, when any exist, the change waits in PENDING_CONFIRMATION until
    // Transfer / Reschedule / Cancel-all is chosen.
    // ==================================================================

    /**
     * Effective availability windows for one date+branch, mirroring
     * getEffectiveSchedules rules: CANCEL wipes the whole day, OVERRIDE
     * replaces template hours, ADD appends extra windows.
     */
    private buildDateWindows(
        weekday: string,
        templates: { day_of_week: string | null; start_time: Date | null; end_time: Date | null }[],
        changes: { mode: string; start_time: Date | null; end_time: Date | null }[]
    ): Array<{ s: number; e: number }> {

        if (changes.some((chg) => chg.mode === "CANCEL")) return [];

        let base = templates
            .filter((t) => (t.day_of_week ?? "").trim().toUpperCase() === weekday && t.start_time && t.end_time)
            .map((t) => ({ s: timeToMinutes(t.start_time!), e: timeToMinutes(t.end_time!) }));

        const overrides = changes.filter((c) => c.mode === "OVERRIDE" && c.start_time && c.end_time);
        if (overrides.length > 0) {
            base = overrides.map((o) => ({ s: timeToMinutes(o.start_time!), e: timeToMinutes(o.end_time!) }));
        }

        const adds = changes
            .filter((c) => c.mode === "ADD" && c.start_time && c.end_time)
            .map((a) => ({ s: timeToMinutes(a.start_time!), e: timeToMinutes(a.end_time!) }));

        return [...base, ...adds];

    }

    private async initiateDateChangeTransfer(
        employeeId: string,
        employee: { user_id?: string | null; department_id?: string | null },
        dto: InitiateTransferDto,
        sc: ScheduleChangeRequestDto,
        requestedBy: string
    ) {

        if (dto.old_branch_id || (dto.close_schedule_ids && dto.close_schedule_ids.length > 0)) {
            throw new Error("schedule_change cannot be combined with old_branch_id or close_schedule_ids");
        }

        if (dto.working_hours && dto.working_hours.length > 0) {
            throw new Error("Provide either working_hours or schedule_change, not both");
        }

        if (!sc.branch_id?.trim()) {
            throw new Error("New branch is required");
        }

        const changeDate = parseDateOnly(sc.change_date);

        // Past dates are frozen: they can never be added, updated or deleted.
        if (changeDate.getTime() < todayDateOnly().getTime()) {
            throw new Error("Past-dated schedule changes cannot be added, updated or deleted.");
        }

        if (!["CREATE", "UPDATE", "DELETE"].includes(sc.action)) {
            throw new Error("Invalid schedule_change.action");
        }

        if (!["ADD", "OVERRIDE", "CANCEL"].includes(sc.mode)) {
            throw new Error("Invalid schedule_change.mode");
        }

        let startTime: Date | null = null;
        let endTime: Date | null = null;

        if (sc.mode !== "CANCEL") {
            if (!sc.start_time || !sc.end_time) {
                throw new Error(`${sc.mode} requires start_time and end_time`);
            }
            if (timeStringToMinutes(sc.start_time) >= timeStringToMinutes(sc.end_time)) {
                throw new Error("start_time must be earlier than end_time");
            }
            startTime = timeStringToDate(sc.start_time);
            endTime = timeStringToDate(sc.end_time);
        } else if (sc.start_time || sc.end_time) {
            throw new Error("CANCEL must not carry start_time or end_time");
        }

        let excludeId: bigint | undefined;

        if (sc.action === "UPDATE" || sc.action === "DELETE") {

            if (!sc.change_id) {
                throw new Error("change_id is required to update or delete a schedule change");
            }

            excludeId = BigInt(sc.change_id);

            const row = await prisma.doctor_schedule_change.findFirst({
                where: { change_id: excludeId, employee_id: employeeId }
            });

            if (!row || !row.is_active) {
                throw new Error("Schedule change not found or already removed");
            }

        } else if (sc.mode !== "ADD") {

            // CREATE non-ADD mirrors the duplicate rule: only ONE active
            // change of any mode per doctor+branch+date.
            const dup = await prisma.doctor_schedule_change.findFirst({
                where: {
                    employee_id: employeeId,
                    branch_id: sc.branch_id,
                    change_date: changeDate,
                    is_active: true
                }
            });

            if (dup) {
                throw new Error(`An active ${dup.mode} schedule change already exists for this branch and date`);
            }

        }

        // Cross-branch overlap rule (mirrors create/update steps): an ADD /
        // OVERRIDE may not overlap any other active ADD/OVERRIDE on the same
        // date regardless of branch.
        if ((sc.action === "CREATE" || sc.action === "UPDATE") && sc.mode !== "CANCEL") {

            const others = await prisma.doctor_schedule_change.findMany({
                where: {
                    employee_id: employeeId,
                    change_date: changeDate,
                    is_active: true,
                    mode: { in: ["ADD", "OVERRIDE"] },
                    ...(excludeId ? { NOT: { change_id: excludeId } } : {})
                },
                select: { branch_id: true, mode: true, start_time: true, end_time: true }
            });

            const ns = timeToMinutes(startTime!);
            const ne = timeToMinutes(endTime!);

            for (const other of others) {
                if (!other.start_time || !other.end_time) continue;
                const os = timeToMinutes(other.start_time);
                const oe = timeToMinutes(other.end_time);
                if (ns < oe && ne > os) {
                    throw new Error(
                        `This ${sc.mode} overlaps an existing ${other.mode} at branch ${other.branch_id}. Nothing was saved.`
                    );
                }
            }

        }

        // Coverage: which booked appointments would lose their window?
        const weekday = toDayOfWeek(changeDate);
        const impact = await this.repository.fetchDataForDateChangeImpact(
            employeeId,
            sc.branch_id,
            changeDate,
            excludeId
        );

        const proposed = [] as Array<{ mode: string; start_time: Date | null; end_time: Date | null }>;
        if (sc.action === "CREATE" || sc.action === "UPDATE") {
            proposed.push({ mode: sc.mode as string, start_time: startTime, end_time: endTime });
        }

        const afterWindows = this.buildDateWindows(weekday, impact.templateSchedules, [
            ...impact.changes.map((chg) => ({
                mode: chg.mode as string,
                start_time: chg.start_time,
                end_time: chg.end_time
            })),
            ...proposed
        ]);

        const dayAppointments = await this.repository.findDayAppointments(
            employeeId,
            sc.branch_id,
            changeDate
        );

        const affected = dayAppointments.filter((appt) => {
            if (!appt.appointment_time) return false;
            const t = timeToMinutes(appt.appointment_time);
            return !afterWindows.some((w) => t >= w.s && t < w.e);
        });

        const snapshotEntry = { __type: "DATE_CHANGE", ...sc };
        const effectiveDate = parseDateOnly(sc.change_date);
        const reasonText = dto.transfer_reason?.trim() || `${sc.action} ${sc.mode} on ${sc.change_date}`;

        if (affected.length === 0) {

            // Nothing to protect - apply instantly and record COMPLETED.
            await prisma.$transaction(async (tx) => {
                await this.applyDateChangeTx(tx, employeeId, sc, requestedBy);
            });

            const transferId = await this.repository.generateTransferId(prisma);
            const now = new Date();

            const completed = await this.repository.createDoctorTransfer(prisma, {
                transfer_id: transferId,
                employee_id: employeeId,
                new_branch_id: sc.branch_id,
                old_department_id: employee.department_id ?? null,
                new_department_id: employee.department_id ?? null,
                effective_date: effectiveDate,
                new_schedule: [snapshotEntry] as unknown as Prisma.InputJsonValue,
                closing_schedule_ids: [],
                transfer_reason: reasonText,
                status: TRANSFER_STATUS.COMPLETED,
                affected_appointment_count: 0,
                requested_by: requestedBy,
                confirmed_by: requestedBy,
                confirmed_at: now,
                completed_at: now
            });

            return {
                transfer_id: completed.transfer_id,
                status: TRANSFER_STATUS.COMPLETED,
                message: "Schedule change applied.",
                affected_appointment_count: 0
            };

        }

        // Affected appointments exist -> PENDING_CONFIRMATION popup flow.
        const summaries = [];

        for (const appt of affected) {
            const base = this.mapAppointmentSummary(appt as any);
            const eligible = await this.findEligibleReplacementDoctors(
                appt.branch_id!,
                employee.department_id ?? null,
                employeeId,
                weekday,
                appt.appointment_time!
            );
            summaries.push({ ...base, eligible_replacement_doctors: eligible });
        }

        const pendingTransferId = await this.repository.generateTransferId(prisma);

        const pending = await this.repository.createDoctorTransfer(prisma, {
            transfer_id: pendingTransferId,
            employee_id: employeeId,
            new_branch_id: sc.branch_id,
            old_department_id: employee.department_id ?? null,
            new_department_id: employee.department_id ?? null,
            effective_date: effectiveDate,
            new_schedule: [snapshotEntry] as unknown as Prisma.InputJsonValue,
            closing_schedule_ids: [],
            transfer_reason: reasonText,
            status: TRANSFER_STATUS.PENDING_CONFIRMATION,
            affected_appointment_count: affected.length,
            requested_by: requestedBy
        });

        return {
            transfer_id: pending.transfer_id,
            status: TRANSFER_STATUS.PENDING_CONFIRMATION,
            message: `${affected.length} appointment(s) on ${sc.change_date} would be stranded by this change. Administrator action is required.`,
            affected_appointment_count: affected.length,
            appointments: summaries,
            actions_required: TRANSFER_ACTION_VALUES
        };

    }

    private async applyDateChangeTx(
        tx: any,
        employeeId: string,
        sc: ScheduleChangeRequestDto,
        actingUserId: string
    ) {

        const changeDate = parseDateOnly(sc.change_date);
        const startTime = sc.mode !== "CANCEL" && sc.start_time ? timeStringToDate(sc.start_time) : null;
        const endTime = sc.mode !== "CANCEL" && sc.end_time ? timeStringToDate(sc.end_time) : null;

        const scheduleService = new DoctorScheduleService();

        if (sc.action === "CREATE") {
            await scheduleService.applyCreateChangeTx(tx, {
                employee_id: employeeId,
                branch_id: sc.branch_id,
                change_date: changeDate,
                mode: sc.mode as any,
                start_time: startTime,
                end_time: endTime,
                reason: sc.reason ?? null,
                created_by: actingUserId,
                consultation_minutes: sc.consultation_minutes ?? null
            });
            return;
        }

        const changeId = BigInt(sc.change_id!);

        if (sc.action === "UPDATE") {
            await scheduleService.applyUpdateChangeTx(tx, changeId, {
                mode: sc.mode as any,
                ...(startTime ? { start_time: startTime } : {}),
                ...(endTime ? { end_time: endTime } : {}),
                ...(sc.reason !== undefined ? { reason: sc.reason } : {}),
                ...(sc.consultation_minutes !== undefined ? { consultation_minutes: sc.consultation_minutes } : {})
            });
            return;
        }

        await scheduleService.applyDeactivateChangeTx(tx, changeId);

    }

    private async findEligibleReplacementDoctors(
        branchId: string,
        departmentId: string | null,
        excludeEmployeeId: string,
        dayOfWeek: string,
        appointmentTime: Date
    ) {

        if (!departmentId) {
            return [];
        }

        const candidates = await this.repository.findEligibleReplacementCandidates(
            branchId,
            departmentId,
            excludeEmployeeId,
            dayOfWeek
        );

        const requestedMinutes = timeToMinutes(appointmentTime);
        const eligible = new Map<string, { employee_id: string; name: string }>();

        for (const schedule of candidates) {

            if (!schedule.start_time || !schedule.end_time) {
                continue;
            }

            const withinSlot =
                requestedMinutes >= timeToMinutes(schedule.start_time) &&
                requestedMinutes < timeToMinutes(schedule.end_time);

            if (withinSlot && schedule.employees) {

                eligible.set(schedule.employees.employee_id!, {
                    employee_id: schedule.employees.employee_id!,
                    name: `${schedule.employees.first_name} ${schedule.employees.last_name}`.trim()
                });

            }

        }

        return Array.from(eligible.values());

    }

    async initiateTransfer(employeeId: string, dto: InitiateTransferDto, requestedBy: string, bypassPending: boolean = false) {

        const employee = await this.resolveDoctor(employeeId);

        const mode = dto.mode ?? "ADD_BRANCH";

        if (!dto.new_branch_id) {
            throw new Error("New branch is required");
        }

        // One doctor, one transfer in flight: a PENDING_CONFIRMATION transfer
        // must be resolved before a new one can be initiated, otherwise
        // overlapping requests can close/re-create the same schedule rows.
        const pendingTransfer = await this.repository.findPendingTransfer(employeeId);

        if (pendingTransfer && !bypassPending) {
            throw new Error(
                `Doctor already has transfer ${pendingTransfer.transfer_id} awaiting confirmation — complete or discard it before starting a new one`
            );
        }

        if (dto.old_branch_id && dto.close_schedule_ids && dto.close_schedule_ids.length > 0) {
            throw new Error("old_branch_id and close_schedule_ids cannot be used together");
        }

        let oldBranchId: string | null = null;
        let requestedCloseScheduleIds: bigint[] = [];

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

            // The destination must NOT already be an active assignment —
            // otherwise the "transfer" silently does nothing at the
            // destination while still closing the source branch.
            const destinationMapping = await this.repository.findActiveBranchMapping(employeeId, dto.new_branch_id, employee.user_id);

            if (destinationMapping) {
                throw new Error("Doctor is already assigned to the destination branch — no transfer is needed");
            }

        } else if (dto.close_schedule_ids && dto.close_schedule_ids.length > 0) {

            // Slot-level move: exactly these rows are closed, nothing else.
            requestedCloseScheduleIds = dto.close_schedule_ids.map(Number).filter(Number.isFinite).map(BigInt);

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

        // A close-only slot move (e.g. cancelling a slot from the Scheduled
        // page) closes existing rows and creates nothing, so it legitimately
        // carries no working_hours. Any other request must bring at least
        // one entry - validated here instead of express-validator because
        // the route-level rule had to become optional for close-only moves.
        if (dto.working_hours && dto.working_hours.length > 0) {
            this.validateWorkingHours(dto.working_hours, dto.new_branch_id);
        } else if (!(mode === "ADD_BRANCH" && (requestedCloseScheduleIds.length > 0 || Boolean(dto.schedule_change)))) {
            throw new Error("At least one working hour entry is required for the new branch");
        }

        // ======================================================
        // DATE_CHANGE FLOW - ADD / OVERRIDE / CANCEL on one exact
        // date, routed through the transfer machinery so affected
        // appointments receive the same Transfer / Reschedule /
        // Cancel popup as recurring-slot moves.
        // ======================================================
        if (dto.schedule_change) {
            return await this.initiateDateChangeTransfer(employeeId, employee, dto, dto.schedule_change, requestedBy);
        }
        const consultationMinutes = dto.consultation_minutes ?? 20;
        const scheduleSnapshot: ScheduleSnapshotEntry[] = (dto.working_hours ?? []).map((hour) => ({
            ...hour,
            consultation_minutes: consultationMinutes
        }));

        const activeSchedules = await this.repository.findAllActiveSchedules(employeeId);

        // The explicitly requested rows being replaced (slot-level move) are
        // excluded from the conflict scan — they are closing anyway.
        const requestedCloseSet = new Set(requestedCloseScheduleIds.map(String));
        const schedulesStaying = activeSchedules.filter(
            (s) => !requestedCloseSet.has(String(s.schedule_id))
        );

        // Every requested close must be one of the doctor's OWN active rows —
        // never anyone else's schedule.
        if (requestedCloseScheduleIds.length > 0) {
            for (const id of requestedCloseScheduleIds) {
                if (!activeSchedules.some((s) => s.schedule_id === id)) {
                    throw new Error(`Schedule ${id} does not belong to this doctor or is not active`);
                }
            }
        }

        const conflictingSchedules = this.findConflictingSchedules(schedulesStaying, dto.working_hours ?? []);

        const describeConflict = (s: (typeof conflictingSchedules)[number]) =>
            `${s.day_of_week} ${formatTimeOfDay(s.start_time!)}–${formatTimeOfDay(s.end_time!)} at branch ${s.branch_id}`;

        // Safety rule: the system only changes what was explicitly asked for.
        // Overlapping slots at a branch the doctor is KEEPING are never
        // silently closed — the request is rejected and the admin decides.
        if (conflictingSchedules.length > 0 && mode === "ADD_BRANCH") {

            throw new Error(
                `New working hours conflict with the doctor's existing schedule: ${conflictingSchedules.map(describeConflict).join(", ")}. ` +
                `Nothing was changed — cancel or edit the conflicting slot first, or choose different hours.`
            );

        }

        if (conflictingSchedules.length > 0 && mode === "TRANSFER" && oldBranchId) {

            const foreignConflicts = conflictingSchedules.filter((s) => s.branch_id !== oldBranchId);

            if (foreignConflicts.length > 0) {

                throw new Error(
                    `New working hours conflict with the doctor's schedule at another branch they are staying at: ${foreignConflicts.map(describeConflict).join(", ")}. ` +
                    `Nothing was changed — cancel or edit the conflicting slot first, or choose different hours.`
                );

            }

        }

        const closingScheduleIds = [
            ...conflictingSchedules.map((s) => s.schedule_id),
            ...requestedCloseScheduleIds
        ];

        // A TRANSFER also closes every schedule the doctor still has at the
        // source branch - they are leaving that branch entirely, not just
        // the slots that clash with the new hours. Those schedules' future
        // appointments flow through the same preview/confirm protection
        // as conflicting ones.
        if (mode === "TRANSFER" && oldBranchId) {

            for (const schedule of activeSchedules) {

                if (
                    schedule.branch_id === oldBranchId &&
                    !closingScheduleIds.includes(schedule.schedule_id)
                ) {
                    closingScheduleIds.push(schedule.schedule_id);
                }

            }

        }

        const completeImmediately = async (affectedCount: number) => prisma.$transaction(async (tx) => {

            const transferId = await this.repository.generateTransferId(tx);
            const now = new Date();

let closedBranchIds: string[];
            if (oldBranchId) {
                // True transfer – close all remaining schedules on the source branch
                closedBranchIds = await this.applyDoctorTransfer(tx, {
                    employee_id: employeeId,
                    employee_user_id: employee.user_id,
                    employee_branch_id: employee.branch_id,
                    old_branch_id: oldBranchId,
                    new_branch_id: dto.new_branch_id,
                    new_department_id: newDepartmentId,
                    effective_date: effectiveDate,
                    new_schedule: scheduleSnapshot,
                    closing_schedule_ids: closingScheduleIds,
                    deletedBy: requestedBy
                });
            } else {
                // Slot‑move / ADD_BRANCH – only the explicit schedule rows are closed
                closedBranchIds = await this.applySlotMove(tx, {
                    employee_id: employeeId,
                    employee_user_id: employee.user_id,
                    employee_branch_id: employee.branch_id,
                    old_branch_id: null,
                    new_branch_id: dto.new_branch_id,
                    new_department_id: newDepartmentId,
                    effective_date: effectiveDate,
                    new_schedule: scheduleSnapshot,
                    closing_schedule_ids: closingScheduleIds,
                    deletedBy: null
                });
            }

            return this.repository.createDoctorTransfer(tx, {
                transfer_id: transferId,
                employee_id: employeeId,
                new_branch_id: dto.new_branch_id,
                old_department_id: oldDepartmentId,
                new_department_id: newDepartmentId,
                effective_date: effectiveDate,
                new_schedule: scheduleSnapshot as unknown as Prisma.InputJsonValue,
                closing_schedule_ids: closingScheduleIds,
                transfer_reason: dto.transfer_reason,
                status: TRANSFER_STATUS.COMPLETED,
                affected_appointment_count: affectedCount,
                requested_by: requestedBy,
                confirmed_by: requestedBy,
                confirmed_at: now,
                completed_at: now
            }).then((transfer) => ({ transfer, closedBranchIds }));

        });

        const describeClosedBranches = (ids: string[]) =>
            ids.length > 0
                ? ` The doctor's assignment at branch ${ids.join(", ")} was also closed (no active schedule remains there).`
                : "";

        if (closingScheduleIds.length === 0) {

            const { transfer } = await completeImmediately(0);

            return {
                transfer_id: transfer.transfer_id,
                status: transfer.status,
                message: "No conflicting schedule found. The doctor was assigned to the new branch immediately.",
                affected_appointment_count: 0
            };

        }

        const closingSchedules = closingScheduleIds.length > 0
            ? await this.repository.findSchedulesByIds(prisma, closingScheduleIds)
            : [];

        const closingBranchIds = Array.from(new Set(closingSchedules.map((s) => s.branch_id)));

        if (mode === "TRANSFER" && oldBranchId) {
            closingBranchIds.push(oldBranchId);
        }

        const { total, appointments } = await this.repository.findFutureAppointmentsByScheduleIds(
            closingScheduleIds,
            effectiveDate,
            {
                employeeId,
                branchIds: closingBranchIds,
                includeAllAtBranches: mode === "TRANSFER" && oldBranchId !== null
            }
        );

        if (total === 0) {

            const { transfer, closedBranchIds } = await completeImmediately(0);

            return {
                transfer_id: transfer.transfer_id,
                status: transfer.status,
                message: `${closingScheduleIds.length} schedule slot(s) were closed and the doctor was assigned to the new branch immediately (no future appointments were affected).${describeClosedBranches(closedBranchIds)}`,
                affected_appointment_count: 0
            };

        }

        const transfer = await prisma.$transaction(async (tx) => {

            const transferId = await this.repository.generateTransferId(tx);

            return this.repository.createDoctorTransfer(tx, {
                transfer_id: transferId,
                employee_id: employeeId,
                new_branch_id: dto.new_branch_id,
                old_department_id: oldDepartmentId,
                new_department_id: newDepartmentId,
                effective_date: effectiveDate,
                new_schedule: scheduleSnapshot as unknown as Prisma.InputJsonValue,
                closing_schedule_ids: closingScheduleIds,
                transfer_reason: dto.transfer_reason,
                status: TRANSFER_STATUS.PENDING_CONFIRMATION,
                affected_appointment_count: total,
                requested_by: requestedBy
            });

        });

        const appointmentsWithCandidates = await Promise.all(
            appointments.map(async (appointment) => ({
                ...this.mapAppointmentSummary(appointment),
                eligible_replacement_doctors: await this.findEligibleReplacementDoctors(
                    appointment.branch_id!,
                    oldDepartmentId,
                    employeeId,
                    toDayOfWeek(appointment.appointment_date),
                    appointment.appointment_time
                )
            }))
        );

        return {
            transfer_id: transfer.transfer_id,
            status: transfer.status,
            message: `${closingScheduleIds.length} conflicting schedule slot(s) have ${total} future appointment(s). Administrator action is required.`,
            affected_appointment_count: total,
            appointments: appointmentsWithCandidates,
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
        replacementUserId: string | null | undefined,
        targetBranchId: string
    ): Promise<{ success: boolean; scheduleId?: bigint; notes: string }> {

        const dayOfWeek = toDayOfWeek(appointment.appointment_date);

        // The replacement must be ACTIVELY assigned to the target branch
        // (user_branch_mapping status 1) — a schedule alone is not an
        // assignment; only mapped doctors can take over appointments there.
        const targetMapping = await this.repository.findActiveBranchMapping(
            replacementEmployeeId,
            targetBranchId,
            replacementUserId
        );

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

        // The source branch travels with the confirm payload (no schema
        // change) so the pending path can close it exactly like the
        // immediate-complete path does at initiate time.
        if (dto.old_branch_id && transfer.new_branch_id === dto.old_branch_id) {
            throw new Error("From and To branches must be different");
        }

        const employee = await this.resolveDoctor(employeeId);

        // Defense in depth: the destination must not be an active assignment
        // at confirm time either (a transfer there would be a no-op for the
        // destination while still closing the source branch). This only
        // applies to TRUE transfers, which always carry old_branch_id —
        // slot-level moves (ADD_BRANCH + close_schedule_ids, confirmed from
        // the Scheduled page without old_branch_id) legitimately target
        // branches the doctor is already assigned to.
        if (dto.old_branch_id) {

            const destinationMapping = await this.repository.findActiveBranchMapping(
                employeeId,
                transfer.new_branch_id,
                employee.user_id
            );

            if (destinationMapping) {
                throw new Error("Doctor is already assigned to the destination branch — no transfer is needed");
            }

        }

        let replacementEmployee: {
            first_name: string;
            last_name: string;
            department_id: string | null;
            user_id: string | null;
        } | null = null;

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

            if (transfer.old_department_id && replacement.department_id !== transfer.old_department_id) {
                throw new Error("Replacement doctor must belong to the same department as the doctor being transferred");
            }

            // Eligibility per exact appointment (branch/day/time) is checked
            // inside the transaction loop below, since conflicts can span
            // several branches - there's no single "target branch" to gate
            // on upfront.
            replacementEmployee = replacement;

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

            // Recompute the closing set at confirm time instead of trusting
            // the initiate-time snapshot: schedules may have been edited (or
            // new ones added) between initiate and confirm, and the set of
            // affected appointments must match what is actually being closed
            // right now - otherwise bookings can be missed or schedules can
            // look "not transferred" after the transfer completes.
            // Split the stored snapshot: DATE_CHANGE transfers carry their
            // payload tagged inside new_schedule; everything else is treated
            // as normal working-hour entries (none for date changes).
            const snapshotEntries = ((transfer.new_schedule ?? []) as any[]);
            const dateChangeEntry = snapshotEntries.find((e) => e && e.__type === "DATE_CHANGE") as ScheduleChangeRequestDto | undefined;
            const workingSnapshot = snapshotEntries.filter((e) => !(e && e.__type === "DATE_CHANGE")) as unknown as ScheduleSnapshotEntry[];
            const activeSchedulesNow = await this.repository.findAllActiveSchedulesInTx(tx, employeeId);
            const closingScheduleIdsNow = this.findConflictingSchedules(
                activeSchedulesNow,
                workingSnapshot
            ).map((s) => s.schedule_id);

            // Rows explicitly requested at initiate time (slot-level moves
            // and close-only cancels) must still close even when a conflict
            // re-scan cannot rediscover them - a close-only cancel has an
            // empty new_schedule snapshot and therefore produces zero
            // conflicts on its own.
            const seenClosingIds = new Set(
                closingScheduleIdsNow.map((id) => id.toString())
            );

            for (const storedId of transfer.closing_schedule_ids ?? []) {

                const key = storedId.toString();

                if (!seenClosingIds.has(key)) {
                    seenClosingIds.add(key);
                    closingScheduleIdsNow.push(storedId);
                }

            }

            if (dto.old_branch_id) {

                for (const schedule of activeSchedulesNow) {

                    if (
                        schedule.branch_id === dto.old_branch_id &&
                        !closingScheduleIdsNow.includes(schedule.schedule_id)
                    ) {
                        closingScheduleIdsNow.push(schedule.schedule_id);
                    }

                }

            }

            const closingSchedulesNow = closingScheduleIdsNow.length > 0
                ? await this.repository.findSchedulesByIds(tx, closingScheduleIdsNow)
                : [];

            const closingBranchIdsNow = Array.from(new Set(closingSchedulesNow.map((s) => s.branch_id)));

            if (dto.old_branch_id) {
                closingBranchIdsNow.push(dto.old_branch_id);
            }

            const appointments = await this.repository.findAllFutureAppointmentsForTransferByScheduleIds(
                tx,
                closingScheduleIdsNow,
                transfer.effective_date,
                {
                    employeeId,
                    branchIds: closingBranchIdsNow,
                    includeAllAtBranches: !!dto.old_branch_id
                }
            );

            summary.total = appointments.length;

            for (const appointment of appointments) {

                await this.repository.lockAppointment(tx, appointment.appointment_id);

                if (dto.action === TRANSFER_ACTION.TRANSFER) {

                    // Defaults to the appointment's OWN branch - that's
                    // physically where the patient is booked - unless the
                    // admin explicitly wants to relocate everyone to a
                    // different branch via replacement_branch_id.
                    const targetBranchId = dto.replacement_branch_id ?? appointment.branch_id!;

                    const outcome = await this.transferSingleAppointment(
                        tx,
                        appointment,
                        dto.replacement_employee_id!,
                        replacementEmployee!,
                        replacementEmployee!.user_id,
                        targetBranchId
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
                        new_branch_id: outcome.success ? targetBranchId : null,
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

if (dto.old_branch_id) {
                // True transfer – close all remaining schedules on the source branch
                await this.applyDoctorTransfer(tx, {
                    employee_id: employeeId,
                    employee_user_id: employee.user_id,
                    employee_branch_id: employee.branch_id,
                    old_branch_id: dto.old_branch_id,
                    new_branch_id: transfer.new_branch_id,
                    new_department_id: transfer.new_department_id,
                    effective_date: transfer.effective_date,
                    new_schedule: workingSnapshot,
                    closing_schedule_ids: closingScheduleIdsNow,
                    deletedBy: dto.action === TRANSFER_ACTION.TRANSFER ? confirmedBy : null
                });
            } else {
                // Slot‑move – only the explicit schedule rows are closed
                await this.applySlotMove(tx, {
                    employee_id: employeeId,
                    employee_user_id: employee.user_id,
                    employee_branch_id: employee.branch_id,
                    old_branch_id: null,
                    new_branch_id: transfer.new_branch_id,
                    new_department_id: transfer.new_department_id,
                    effective_date: transfer.effective_date,
                    new_schedule: workingSnapshot,
                    closing_schedule_ids: closingScheduleIdsNow,
                    deletedBy: null
                });
            }

            // A confirmed DATE_CHANGE applies its stored change atomically
            // with the appointment actions above.
            if (dateChangeEntry) {
                await this.applyDateChangeTx(tx, employeeId, dateChangeEntry, confirmedBy);
            }

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

            const mapping = await this.repository.findActiveBranchMapping(dto.employee_id, dto.branch_id, employee.user_id);

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
