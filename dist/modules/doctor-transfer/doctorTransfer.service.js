"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoctorTransferService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const doctorTransfer_repository_1 = require("./doctorTransfer.repository");
const appointment_repository_1 = require("../appointment/appointment.repository");
const appointment_service_1 = require("../appointment/appointment.service");
const appointment_constants_1 = require("../appointment/appointment.constants");
const appointment_utils_1 = require("../appointment/appointment.utils");
const doctorTransfer_constants_1 = require("./doctorTransfer.constants");
const doctorSchedule_service_1 = require("../doctor-schedule/doctorSchedule.service");
function todayDateOnly() {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}
function formatDateOnly(date) {
    return date.toISOString().slice(0, 10);
}
function normalizeDayOfWeek(day) {
    return day.trim().toUpperCase();
}
class DoctorTransferService {
    repository = new doctorTransfer_repository_1.DoctorTransferRepository();
    appointmentRepository = new appointment_repository_1.AppointmentRepository();
    appointmentService = new appointment_service_1.AppointmentService();
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
            hour.day_of_week = normalizeDayOfWeek(hour.day_of_week);
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
    async applySlotMove(tx, params) {
        const now = new Date();
        const closedBranchIds = [];
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
                day_of_week: normalizeDayOfWeek(schedule.day_of_week),
                shift_name: schedule.shift_name,
                start_time: (0, appointment_utils_1.timeStringToDate)(schedule.start_time),
                end_time: (0, appointment_utils_1.timeStringToDate)(schedule.end_time),
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
    async applyDoctorTransfer(tx, params) {
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
    buildDateWindows(weekday, templates, changes) {
        if (changes.some((chg) => chg.mode === "CANCEL"))
            return [];
        let base = templates
            .filter((t) => (t.day_of_week ?? "").trim().toUpperCase() === weekday && t.start_time && t.end_time)
            .map((t) => ({ s: (0, appointment_utils_1.timeToMinutes)(t.start_time), e: (0, appointment_utils_1.timeToMinutes)(t.end_time) }));
        const overrides = changes.filter((c) => c.mode === "OVERRIDE" && c.start_time && c.end_time);
        if (overrides.length > 0) {
            base = overrides.map((o) => ({ s: (0, appointment_utils_1.timeToMinutes)(o.start_time), e: (0, appointment_utils_1.timeToMinutes)(o.end_time) }));
        }
        const adds = changes
            .filter((c) => c.mode === "ADD" && c.start_time && c.end_time)
            .map((a) => ({ s: (0, appointment_utils_1.timeToMinutes)(a.start_time), e: (0, appointment_utils_1.timeToMinutes)(a.end_time) }));
        return [...base, ...adds];
    }
    async initiateDateChangeTransfer(employeeId, employee, dto, sc, requestedBy) {
        if (dto.old_branch_id || (dto.close_schedule_ids && dto.close_schedule_ids.length > 0)) {
            throw new Error("schedule_change cannot be combined with old_branch_id or close_schedule_ids");
        }
        if (dto.working_hours && dto.working_hours.length > 0) {
            throw new Error("Provide either working_hours or schedule_change, not both");
        }
        if (!sc.branch_id?.trim()) {
            throw new Error("New branch is required");
        }
        const changeDate = (0, appointment_utils_1.parseDateOnly)(sc.change_date);
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
        let startTime = null;
        let endTime = null;
        if (sc.mode !== "CANCEL") {
            if (!sc.start_time || !sc.end_time) {
                throw new Error(`${sc.mode} requires start_time and end_time`);
            }
            if ((0, appointment_utils_1.timeStringToMinutes)(sc.start_time) >= (0, appointment_utils_1.timeStringToMinutes)(sc.end_time)) {
                throw new Error("start_time must be earlier than end_time");
            }
            startTime = (0, appointment_utils_1.timeStringToDate)(sc.start_time);
            endTime = (0, appointment_utils_1.timeStringToDate)(sc.end_time);
        }
        else if (sc.start_time || sc.end_time) {
            throw new Error("CANCEL must not carry start_time or end_time");
        }
        let excludeId;
        if (sc.action === "UPDATE" || sc.action === "DELETE") {
            if (!sc.change_id) {
                throw new Error("change_id is required to update or delete a schedule change");
            }
            excludeId = BigInt(sc.change_id);
            const row = await prisma_1.default.doctor_schedule_change.findFirst({
                where: { change_id: excludeId, employee_id: employeeId }
            });
            if (!row || !row.is_active) {
                throw new Error("Schedule change not found or already removed");
            }
        }
        else if (sc.mode !== "ADD") {
            // CREATE non-ADD mirrors the duplicate rule: only ONE active
            // change of any mode per doctor+branch+date.
            const dup = await prisma_1.default.doctor_schedule_change.findFirst({
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
            const others = await prisma_1.default.doctor_schedule_change.findMany({
                where: {
                    employee_id: employeeId,
                    change_date: changeDate,
                    is_active: true,
                    mode: { in: ["ADD", "OVERRIDE"] },
                    ...(excludeId ? { NOT: { change_id: excludeId } } : {})
                },
                select: { branch_id: true, mode: true, start_time: true, end_time: true }
            });
            const ns = (0, appointment_utils_1.timeToMinutes)(startTime);
            const ne = (0, appointment_utils_1.timeToMinutes)(endTime);
            for (const other of others) {
                if (!other.start_time || !other.end_time)
                    continue;
                const os = (0, appointment_utils_1.timeToMinutes)(other.start_time);
                const oe = (0, appointment_utils_1.timeToMinutes)(other.end_time);
                if (ns < oe && ne > os) {
                    throw new Error(`This ${sc.mode} overlaps an existing ${other.mode} at branch ${other.branch_id}. Nothing was saved.`);
                }
            }
        }
        // Coverage: which booked appointments would lose their window?
        const weekday = (0, appointment_utils_1.toDayOfWeek)(changeDate);
        const impact = await this.repository.fetchDataForDateChangeImpact(employeeId, sc.branch_id, changeDate, excludeId);
        const proposed = [];
        if (sc.action === "CREATE" || sc.action === "UPDATE") {
            proposed.push({ mode: sc.mode, start_time: startTime, end_time: endTime });
        }
        const afterWindows = this.buildDateWindows(weekday, impact.templateSchedules, [
            ...impact.changes.map((chg) => ({
                mode: chg.mode,
                start_time: chg.start_time,
                end_time: chg.end_time
            })),
            ...proposed
        ]);
        const dayAppointments = await this.repository.findDayAppointments(employeeId, sc.branch_id, changeDate);
        const affected = dayAppointments.filter((appt) => {
            if (!appt.appointment_time)
                return false;
            const t = (0, appointment_utils_1.timeToMinutes)(appt.appointment_time);
            return !afterWindows.some((w) => t >= w.s && t < w.e);
        });
        const snapshotEntry = { __type: "DATE_CHANGE", ...sc };
        const effectiveDate = (0, appointment_utils_1.parseDateOnly)(sc.change_date);
        const reasonText = dto.transfer_reason?.trim() || `${sc.action} ${sc.mode} on ${sc.change_date}`;
        if (affected.length === 0) {
            // Nothing to protect - apply instantly and record COMPLETED.
            await prisma_1.default.$transaction(async (tx) => {
                await this.applyDateChangeTx(tx, employeeId, sc, requestedBy);
            });
            const transferId = await this.repository.generateTransferId(prisma_1.default);
            const now = new Date();
            const completed = await this.repository.createDoctorTransfer(prisma_1.default, {
                transfer_id: transferId,
                employee_id: employeeId,
                new_branch_id: sc.branch_id,
                old_department_id: employee.department_id ?? null,
                new_department_id: employee.department_id ?? null,
                effective_date: effectiveDate,
                new_schedule: [snapshotEntry],
                closing_schedule_ids: [],
                transfer_reason: reasonText,
                status: doctorTransfer_constants_1.TRANSFER_STATUS.COMPLETED,
                affected_appointment_count: 0,
                requested_by: requestedBy,
                confirmed_by: requestedBy,
                confirmed_at: now,
                completed_at: now
            });
            return {
                transfer_id: completed.transfer_id,
                status: doctorTransfer_constants_1.TRANSFER_STATUS.COMPLETED,
                message: "Schedule change applied.",
                affected_appointment_count: 0
            };
        }
        // Affected appointments exist -> PENDING_CONFIRMATION popup flow.
        const summaries = [];
        for (const appt of affected) {
            const base = this.mapAppointmentSummary(appt);
            const eligible = await this.findEligibleReplacementDoctors(appt.branch_id, employee.department_id ?? null, employeeId, weekday, appt.appointment_time);
            summaries.push({ ...base, eligible_replacement_doctors: eligible });
        }
        const pendingTransferId = await this.repository.generateTransferId(prisma_1.default);
        const pending = await this.repository.createDoctorTransfer(prisma_1.default, {
            transfer_id: pendingTransferId,
            employee_id: employeeId,
            new_branch_id: sc.branch_id,
            old_department_id: employee.department_id ?? null,
            new_department_id: employee.department_id ?? null,
            effective_date: effectiveDate,
            new_schedule: [snapshotEntry],
            closing_schedule_ids: [],
            transfer_reason: reasonText,
            status: doctorTransfer_constants_1.TRANSFER_STATUS.PENDING_CONFIRMATION,
            affected_appointment_count: affected.length,
            requested_by: requestedBy
        });
        return {
            transfer_id: pending.transfer_id,
            status: doctorTransfer_constants_1.TRANSFER_STATUS.PENDING_CONFIRMATION,
            message: `${affected.length} appointment(s) on ${sc.change_date} would be stranded by this change. Administrator action is required.`,
            affected_appointment_count: affected.length,
            appointments: summaries,
            actions_required: doctorTransfer_constants_1.TRANSFER_ACTION_VALUES
        };
    }
    async applyDateChangeTx(tx, employeeId, sc, actingUserId) {
        const changeDate = (0, appointment_utils_1.parseDateOnly)(sc.change_date);
        const startTime = sc.mode !== "CANCEL" && sc.start_time ? (0, appointment_utils_1.timeStringToDate)(sc.start_time) : null;
        const endTime = sc.mode !== "CANCEL" && sc.end_time ? (0, appointment_utils_1.timeStringToDate)(sc.end_time) : null;
        const scheduleService = new doctorSchedule_service_1.DoctorScheduleService();
        if (sc.action === "CREATE") {
            await scheduleService.applyCreateChangeTx(tx, {
                employee_id: employeeId,
                branch_id: sc.branch_id,
                change_date: changeDate,
                mode: sc.mode,
                start_time: startTime,
                end_time: endTime,
                reason: sc.reason ?? null,
                created_by: actingUserId,
                consultation_minutes: sc.consultation_minutes ?? null
            });
            return;
        }
        const changeId = BigInt(sc.change_id);
        if (sc.action === "UPDATE") {
            await scheduleService.applyUpdateChangeTx(tx, changeId, {
                mode: sc.mode,
                ...(startTime ? { start_time: startTime } : {}),
                ...(endTime ? { end_time: endTime } : {}),
                ...(sc.reason !== undefined ? { reason: sc.reason } : {}),
                ...(sc.consultation_minutes !== undefined ? { consultation_minutes: sc.consultation_minutes } : {})
            });
            return;
        }
        await scheduleService.applyDeactivateChangeTx(tx, changeId);
    }
    async findEligibleReplacementDoctors(branchId, departmentId, excludeEmployeeId, dayOfWeek, appointmentTime) {
        if (!departmentId) {
            return [];
        }
        // Support both appointment day and previous day for overnight shifts
        const dayIdx = appointment_constants_1.DAY_OF_WEEK_NAMES.indexOf(dayOfWeek);
        const prevDayOfWeek = dayIdx >= 0
            ? appointment_constants_1.DAY_OF_WEEK_NAMES[(dayIdx + 6) % 7]
            : dayOfWeek;
        // 1. All active doctors strictly mapped to this branch and department
        const allMappedDoctors = await this.repository.findActiveDepartmentDoctorsAtBranch(branchId, departmentId, excludeEmployeeId);
        // 2. All schedules for this branch & department on today / yesterday
        const candidateSchedules = await this.repository.findEligibleReplacementCandidates(branchId, departmentId, excludeEmployeeId, [dayOfWeek, prevDayOfWeek]);
        const requestedMinutes = (0, appointment_utils_1.timeToMinutes)(appointmentTime);
        // Group candidate schedules by doctor employee_id
        const schedulesByDoctor = new Map();
        for (const s of candidateSchedules) {
            const docId = s.employee_id;
            if (!docId)
                continue;
            const list = schedulesByDoctor.get(docId) ?? [];
            list.push(s);
            schedulesByDoctor.set(docId, list);
        }
        const results = [];
        for (const doc of allMappedDoctors) {
            if (!doc.employee_id)
                continue;
            const docId = doc.employee_id;
            const docName = `${doc.first_name || ""} ${doc.last_name || ""}`.trim();
            const schedules = schedulesByDoctor.get(docId) ?? [];
            if (schedules.length === 0) {
                results.push({
                    employee_id: docId,
                    name: docName,
                    match_type: "OFF_DUTY",
                    rank: 4,
                    mismatch_minutes: 9999,
                    mismatch_text: `Off duty on ${dayOfWeek}`
                });
                continue;
            }
            // Evaluate best schedule for this doctor
            let bestCandidate = null;
            for (const schedule of schedules) {
                if (!schedule.start_time || !schedule.end_time)
                    continue;
                const isYesterday = schedule.day_of_week === prevDayOfWeek;
                const sStart = (0, appointment_utils_1.timeToMinutes)(schedule.start_time);
                let sEnd = (0, appointment_utils_1.timeToMinutes)(schedule.end_time);
                if (sEnd <= sStart) {
                    sEnd += 1440; // Overnight shift
                }
                if (isYesterday && sEnd <= 1440) {
                    continue;
                }
                let reqMin = requestedMinutes;
                if (isYesterday) {
                    reqMin += 1440;
                }
                else if (reqMin < sStart && sEnd > 1440) {
                    reqMin += 1440;
                }
                const shiftStartLabel = (0, appointment_utils_1.formatMinutesTo12Hour)(sStart);
                const shiftEndLabel = (0, appointment_utils_1.formatMinutesTo12Hour)(sEnd);
                let evalResult;
                if (sStart <= reqMin && reqMin < sEnd) {
                    // Appointment falls within shift: anchor 1-hour session block
                    const baseOffset = Math.floor((reqMin - sStart) / 60) * 60;
                    const sessionStart = sStart + baseOffset;
                    const sessionEnd = Math.min(sEnd, sStart + baseOffset + 60);
                    const sessionLabel = `${(0, appointment_utils_1.formatMinutesTo12Hour)(sessionStart)} - ${(0, appointment_utils_1.formatMinutesTo12Hour)(sessionEnd)}`;
                    evalResult = {
                        employee_id: docId,
                        name: docName,
                        shift_start: shiftStartLabel,
                        shift_end: shiftEndLabel,
                        match_type: "EXACT_SESSION",
                        session_label: sessionLabel,
                        mismatch_minutes: 0,
                        mismatch_text: `Exact 1-hr session: ${sessionLabel}`,
                        rank: 1
                    };
                }
                else if (reqMin < sStart) {
                    const diff = sStart - reqMin;
                    if (diff <= 30) {
                        evalResult = {
                            employee_id: docId,
                            name: docName,
                            shift_start: shiftStartLabel,
                            shift_end: shiftEndLabel,
                            match_type: "BUFFER_MATCH",
                            mismatch_minutes: diff,
                            mismatch_text: `+${diff}m buffer (Shift starts ${shiftStartLabel})`,
                            rank: 2
                        };
                    }
                    else {
                        const hrs = Math.floor(diff / 60);
                        const mins = diff % 60;
                        const diffStr = hrs > 0 ? (mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`) : `${mins}m`;
                        evalResult = {
                            employee_id: docId,
                            name: docName,
                            shift_start: shiftStartLabel,
                            shift_end: shiftEndLabel,
                            match_type: "MISMATCH",
                            mismatch_minutes: diff,
                            mismatch_text: `Shift: ${shiftStartLabel} - ${shiftEndLabel} (${diffStr} after appt)`,
                            rank: 3
                        };
                    }
                }
                else {
                    const diff = reqMin - sEnd;
                    if (diff <= 30) {
                        evalResult = {
                            employee_id: docId,
                            name: docName,
                            shift_start: shiftStartLabel,
                            shift_end: shiftEndLabel,
                            match_type: "BUFFER_MATCH",
                            mismatch_minutes: -diff,
                            mismatch_text: `-${diff}m buffer (Shift ended ${shiftEndLabel})`,
                            rank: 2
                        };
                    }
                    else {
                        const hrs = Math.floor(diff / 60);
                        const mins = diff % 60;
                        const diffStr = hrs > 0 ? (mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`) : `${mins}m`;
                        evalResult = {
                            employee_id: docId,
                            name: docName,
                            shift_start: shiftStartLabel,
                            shift_end: shiftEndLabel,
                            match_type: "MISMATCH",
                            mismatch_minutes: -diff,
                            mismatch_text: `Shift: ${shiftStartLabel} - ${shiftEndLabel} (${diffStr} before appt)`,
                            rank: 3
                        };
                    }
                }
                if (!bestCandidate || evalResult.rank < bestCandidate.rank || (evalResult.rank === bestCandidate.rank && Math.abs(evalResult.mismatch_minutes ?? 0) < Math.abs(bestCandidate.mismatch_minutes ?? 0))) {
                    bestCandidate = evalResult;
                }
            }
            if (bestCandidate) {
                results.push(bestCandidate);
            }
        }
        // Sort by rank ascending, then absolute mismatch minutes ascending
        results.sort((a, b) => {
            if (a.rank !== b.rank)
                return a.rank - b.rank;
            return Math.abs(a.mismatch_minutes ?? 0) - Math.abs(b.mismatch_minutes ?? 0);
        });
        return results;
    }
    async initiateTransfer(employeeId, dto, requestedBy, bypassPending = false) {
        const employee = await this.resolveDoctor(employeeId);
        const mode = dto.mode ?? "ADD_BRANCH";
        if (!dto.new_branch_id) {
            throw new Error("New branch is required");
        }
        // Auto-expire any stale pending transfers whose effective date has passed
        const today = todayDateOnly();
        await this.repository.expireStalePendingTransfers(today, employeeId);
        // One doctor, one transfer in flight: a PENDING_CONFIRMATION transfer
        // must be resolved before a new one can be initiated, otherwise
        // overlapping requests can close/re-create the same schedule rows.
        const pendingTransfer = await this.repository.findPendingTransfer(employeeId, today);
        if (pendingTransfer) {
            if (bypassPending) {
                await this.repository.discardPendingTransfer(pendingTransfer.transfer_id, requestedBy, "Superseded by new transfer");
            }
            else {
                throw new Error(`Doctor already has transfer ${pendingTransfer.transfer_id} awaiting confirmation — complete or discard it before starting a new one`);
            }
        }
        if (dto.old_branch_id && dto.close_schedule_ids && dto.close_schedule_ids.length > 0) {
            throw new Error("old_branch_id and close_schedule_ids cannot be used together");
        }
        let oldBranchId = null;
        let requestedCloseScheduleIds = [];
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
        }
        else if (dto.close_schedule_ids && dto.close_schedule_ids.length > 0) {
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
        const transferReason = dto.transfer_reason?.trim() || (dto.mode === "ADD_BRANCH" ? "Doctor branch assignment" : "Doctor branch transfer");
        if (!dto.effective_date) {
            throw new Error("Effective date is required");
        }
        const effectiveDate = (0, appointment_utils_1.parseDateOnly)(dto.effective_date);
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
        }
        else if (!(mode === "ADD_BRANCH" && (requestedCloseScheduleIds.length > 0 || Boolean(dto.schedule_change)))) {
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
        const scheduleSnapshot = (dto.working_hours ?? []).map((hour) => ({
            ...hour,
            consultation_minutes: consultationMinutes
        }));
        const storedSnapshot = [
            ...scheduleSnapshot,
            ...(oldBranchId ? [{ __meta: "TRANSFER_METADATA", old_branch_id: oldBranchId }] : [])
        ];
        const activeSchedules = await this.repository.findAllActiveSchedules(employeeId);
        // The explicitly requested rows being replaced (slot-level move) are
        // excluded from the conflict scan — they are closing anyway.
        const requestedCloseSet = new Set(requestedCloseScheduleIds.map(String));
        const schedulesStaying = activeSchedules.filter((s) => !requestedCloseSet.has(String(s.schedule_id)));
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
        const describeConflict = (s) => `${s.day_of_week} ${(0, appointment_utils_1.formatTimeOfDay)(s.start_time)}–${(0, appointment_utils_1.formatTimeOfDay)(s.end_time)} at branch ${s.branch_id}`;
        // Safety rule: the system only changes what was explicitly asked for.
        // Overlapping slots at a branch the doctor is KEEPING are never
        // silently closed — the request is rejected and the admin decides.
        if (conflictingSchedules.length > 0 && mode === "ADD_BRANCH") {
            throw new Error(`New working hours conflict with the doctor's existing schedule: ${conflictingSchedules.map(describeConflict).join(", ")}. ` +
                `Nothing was changed — cancel or edit the conflicting slot first, or choose different hours.`);
        }
        if (conflictingSchedules.length > 0 && mode === "TRANSFER" && oldBranchId) {
            const foreignConflicts = conflictingSchedules.filter((s) => s.branch_id !== oldBranchId);
            if (foreignConflicts.length > 0) {
                throw new Error(`New working hours conflict with the doctor's schedule at another branch they are staying at: ${foreignConflicts.map(describeConflict).join(", ")}. ` +
                    `Nothing was changed — cancel or edit the conflicting slot first, or choose different hours.`);
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
                if (schedule.branch_id === oldBranchId &&
                    !closingScheduleIds.includes(schedule.schedule_id)) {
                    closingScheduleIds.push(schedule.schedule_id);
                }
            }
        }
        const completeImmediately = async (affectedCount) => prisma_1.default.$transaction(async (tx) => {
            const transferId = await this.repository.generateTransferId(tx);
            const now = new Date();
            let closedBranchIds;
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
            }
            else {
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
                new_schedule: scheduleSnapshot,
                closing_schedule_ids: closingScheduleIds,
                transfer_reason: transferReason,
                status: doctorTransfer_constants_1.TRANSFER_STATUS.COMPLETED,
                affected_appointment_count: affectedCount,
                requested_by: requestedBy,
                confirmed_by: requestedBy,
                confirmed_at: now,
                completed_at: now
            }).then((transfer) => ({ transfer, closedBranchIds }));
        });
        const describeClosedBranches = (ids) => ids.length > 0
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
            ? await this.repository.findSchedulesByIds(prisma_1.default, closingScheduleIds)
            : [];
        const closingBranchIds = Array.from(new Set(closingSchedules.map((s) => s.branch_id)));
        if (mode === "TRANSFER" && oldBranchId) {
            closingBranchIds.push(oldBranchId);
        }
        const { total, appointments } = await this.repository.findFutureAppointmentsByScheduleIds(closingScheduleIds, effectiveDate, {
            employeeId,
            branchIds: closingBranchIds,
            includeAllAtBranches: mode === "TRANSFER" && oldBranchId !== null
        });
        if (total === 0) {
            const { transfer, closedBranchIds } = await completeImmediately(0);
            return {
                transfer_id: transfer.transfer_id,
                status: transfer.status,
                message: `${closingScheduleIds.length} schedule slot(s) were closed and the doctor was assigned to the new branch immediately (no future appointments were affected).${describeClosedBranches(closedBranchIds)}`,
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
                new_schedule: storedSnapshot,
                closing_schedule_ids: closingScheduleIds,
                transfer_reason: transferReason,
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
            old_branch_id: oldBranchId || undefined,
            message: `${closingScheduleIds.length} conflicting schedule slot(s) have ${total} future appointment(s). Administrator action is required.`,
            affected_appointment_count: total,
            appointments: appointmentsWithCandidates,
            actions_required: doctorTransfer_constants_1.TRANSFER_ACTION_VALUES
        };
    }
    async transferSingleAppointment(tx, appointment, replacementEmployeeId, replacementEmployee, replacementUserId, targetBranchId, customTime) {
        const dayOfWeek = (0, appointment_utils_1.toDayOfWeek)(appointment.appointment_date);
        const prevDayOfWeek = (0, appointment_utils_1.toDayOfWeek)((0, appointment_utils_1.addDays)(appointment.appointment_date, -1));
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
        // Fetch candidate schedules for today and yesterday (to cover overnight shifts)
        const candidateSchedules = await tx.doctor_schedule.findMany({
            where: {
                employee_id: replacementEmployeeId,
                branch_id: targetBranchId,
                day_of_week: { in: [dayOfWeek, prevDayOfWeek] },
                is_active: true
            }
        });
        if (candidateSchedules.length === 0) {
            return {
                success: false,
                notes: `Replacement doctor has no active schedule at branch ${targetBranchId} on ${dayOfWeek}`
            };
        }
        const requestedMinutes = (0, appointment_utils_1.timeToMinutes)(appointment.appointment_time);
        const durationMinutes = appointment.duration_minutes ?? 10;
        const BUFFER_LIMIT = 30; // ±30m buffer
        // Fetch existing bookings around this appointment date to compute dynamic progression & avoid collisions
        const bookedAppointments = await tx.appointment_history.findMany({
            where: {
                employee_id: replacementEmployeeId,
                appointment_date: {
                    in: [
                        (0, appointment_utils_1.addDays)(appointment.appointment_date, -1),
                        appointment.appointment_date,
                        (0, appointment_utils_1.addDays)(appointment.appointment_date, 1)
                    ]
                },
                status: { notIn: appointment_constants_1.NON_BLOCKING_APPOINTMENT_STATUSES },
                appointment_id: { not: appointment.appointment_id }
            },
            select: {
                appointment_id: true,
                appointment_date: true,
                appointment_time: true,
                duration_minutes: true
            }
        });
        if (customTime) {
            const customMin = (0, appointment_utils_1.timeStringToMinutes)(customTime);
            let matchedShiftStart = 0;
            let matchedShiftEnd = 0;
            let matchedShiftMin = customMin;
            const sched = candidateSchedules.find((s) => {
                if (!s.start_time || !s.end_time)
                    return false;
                const sStart = (0, appointment_utils_1.timeToMinutes)(s.start_time);
                let sEnd = (0, appointment_utils_1.timeToMinutes)(s.end_time);
                if (sEnd <= sStart)
                    sEnd += 1440;
                let m = customMin;
                if (s.day_of_week === prevDayOfWeek)
                    m += 1440;
                else if (m < sStart && sEnd > 1440)
                    m += 1440;
                const inShift = m >= sStart && m < sEnd;
                if (inShift) {
                    matchedShiftStart = sStart;
                    matchedShiftEnd = sEnd;
                    matchedShiftMin = m;
                }
                return inShift;
            });
            if (!sched) {
                return {
                    success: false,
                    notes: `Custom time ${customTime} is outside doctor's schedule on ${dayOfWeek}`
                };
            }
            if (matchedShiftMin + durationMinutes > matchedShiftEnd) {
                return {
                    success: false,
                    notes: `Custom time ${customTime} (${durationMinutes}m consultation) extends past shift end at ${(0, appointment_utils_1.formatMinutesTo12Hour)(matchedShiftEnd % 1440)}`
                };
            }
            const isYesterdaySchedule = sched.day_of_week === prevDayOfWeek;
            const shiftBaseDate = isYesterdaySchedule
                ? (0, appointment_utils_1.addDays)(appointment.appointment_date, -1)
                : appointment.appointment_date;
            const collision = bookedAppointments.some((b) => {
                if (!b.appointment_time)
                    return false;
                let bStart = (0, appointment_utils_1.timeToMinutes)(b.appointment_time);
                const bDateStr = formatDateOnly(b.appointment_date);
                const sDateStr = formatDateOnly(shiftBaseDate);
                if (bDateStr !== sDateStr)
                    bStart += 1440;
                const bEnd = bStart + (b.duration_minutes ?? 10);
                return matchedShiftMin < bEnd && (matchedShiftMin + durationMinutes) > bStart;
            });
            if (collision) {
                return {
                    success: false,
                    notes: `Doctor already has a consultation booked at/around ${customTime}. Please choose an open slot.`
                };
            }
            const dayOffset = Math.floor(matchedShiftMin / 1440);
            const effectiveDate = (0, appointment_utils_1.addDays)(shiftBaseDate, dayOffset);
            const targetTime = (0, appointment_utils_1.timeStringToDate)((0, appointment_utils_1.minutesToHHmm)(matchedShiftMin % 1440));
            await this.appointmentRepository.lockDoctorSchedule(tx, sched.schedule_id);
            const tokenNumber = await this.appointmentRepository.generateTokenNumber(tx, sched.schedule_id, effectiveDate, replacementEmployeeId, targetTime);
            const doctorName = `${replacementEmployee.first_name} ${replacementEmployee.last_name}`.trim();
            await this.repository.updateAppointment(tx, appointment.appointment_id, {
                employee_id: replacementEmployeeId,
                branch_id: targetBranchId,
                schedule_id: sched.schedule_id,
                appointment_date: effectiveDate,
                appointment_time: targetTime,
                token_number: tokenNumber,
                doctor_name: doctorName,
                assigned_doctor: doctorName
            });
            return {
                success: true,
                scheduleId: sched.schedule_id,
                notes: `Reassigned to Dr. ${doctorName} at ${customTime} (manual time adjustment)`
            };
        }
        const validMatches = [];
        for (const schedule of candidateSchedules) {
            if (!schedule.start_time || !schedule.end_time)
                continue;
            const isYesterdaySchedule = schedule.day_of_week === prevDayOfWeek;
            const shiftStartMin = (0, appointment_utils_1.timeToMinutes)(schedule.start_time);
            let shiftEndMin = (0, appointment_utils_1.timeToMinutes)(schedule.end_time);
            if (shiftEndMin <= shiftStartMin) {
                shiftEndMin += 1440; // Overnight shift
            }
            // A schedule from yesterday only covers today if it ran past midnight
            if (isYesterdaySchedule && shiftEndMin <= 1440) {
                continue;
            }
            let normApptMinutes = requestedMinutes;
            if (isYesterdaySchedule) {
                normApptMinutes += 1440;
            }
            else if (normApptMinutes < shiftStartMin && shiftEndMin > 1440) {
                normApptMinutes += 1440;
            }
            // Check if shift overlaps the [normApptMinutes - 30, normApptMinutes + 30] buffer window
            if (shiftStartMin > normApptMinutes + BUFFER_LIMIT || shiftEndMin <= normApptMinutes - BUFFER_LIMIT) {
                continue;
            }
            const shiftBaseDate = isYesterdaySchedule
                ? (0, appointment_utils_1.addDays)(appointment.appointment_date, -1)
                : appointment.appointment_date;
            // Anchor 1-hour session blocks to shift start
            const baseSlotOffset = Math.floor(Math.max(0, normApptMinutes - shiftStartMin) / 60) * 60;
            // Check current 1-hour session, plus adjacent sessions if within ±30m buffer
            const candidateOffsets = [baseSlotOffset];
            if (baseSlotOffset - 60 >= 0 && (shiftStartMin + baseSlotOffset - 60 + 60) > (normApptMinutes - BUFFER_LIMIT)) {
                candidateOffsets.push(baseSlotOffset - 60);
            }
            if ((shiftStartMin + baseSlotOffset + 60) < shiftEndMin && (shiftStartMin + baseSlotOffset + 60) <= (normApptMinutes + BUFFER_LIMIT)) {
                candidateOffsets.push(baseSlotOffset + 60);
            }
            for (const offset of candidateOffsets) {
                const blockStartMinutes = shiftStartMin + offset;
                const blockEndMinutes = Math.min(blockStartMinutes + 60, shiftEndMin);
                // Bookings in this 1-hour session
                const sessionBookings = bookedAppointments.filter((b) => {
                    if (!b.appointment_time)
                        return false;
                    let bStart = (0, appointment_utils_1.timeToMinutes)(b.appointment_time);
                    const bDateStr = formatDateOnly(b.appointment_date);
                    const sDateStr = formatDateOnly(shiftBaseDate);
                    if (bDateStr !== sDateStr)
                        bStart += 1440;
                    const bEnd = bStart + (b.duration_minutes ?? 10);
                    return bStart < blockEndMinutes && bEnd > blockStartMinutes;
                });
                // Dynamic progression: earliest available consultation start
                const latestPriorEnd = sessionBookings.length > 0
                    ? Math.max(...sessionBookings.map((b) => {
                        let bStart = (0, appointment_utils_1.timeToMinutes)(b.appointment_time);
                        const bDateStr = formatDateOnly(b.appointment_date);
                        const sDateStr = formatDateOnly(shiftBaseDate);
                        if (bDateStr !== sDateStr)
                            bStart += 1440;
                        return bStart + (b.duration_minutes ?? 10);
                    }))
                    : blockStartMinutes;
                const candidateStart = Math.max(blockStartMinutes, latestPriorEnd);
                // Check collision with any existing booking at or after candidateStart
                const collision = bookedAppointments.some((b) => {
                    if (!b.appointment_time)
                        return false;
                    let bStart = (0, appointment_utils_1.timeToMinutes)(b.appointment_time);
                    const bDateStr = formatDateOnly(b.appointment_date);
                    const sDateStr = formatDateOnly(shiftBaseDate);
                    if (bDateStr !== sDateStr)
                        bStart += 1440;
                    const bEnd = bStart + (b.duration_minutes ?? 10);
                    return candidateStart < bEnd && (candidateStart + durationMinutes) > bStart;
                });
                if (!collision && candidateStart + durationMinutes <= shiftEndMin) {
                    const deltaMinutes = candidateStart - normApptMinutes;
                    if (Math.abs(deltaMinutes) <= BUFFER_LIMIT) {
                        const dayOffset = Math.floor(candidateStart / 1440);
                        const effectiveDate = (0, appointment_utils_1.addDays)(shiftBaseDate, dayOffset);
                        const sessionLabel = `${(0, appointment_utils_1.formatMinutesTo12Hour)(blockStartMinutes % 1440)} - ${(0, appointment_utils_1.formatMinutesTo12Hour)(blockEndMinutes % 1440)}`;
                        validMatches.push({
                            schedule,
                            candidateStartMinutes: candidateStart % 1440,
                            effectiveDate,
                            deltaMinutes,
                            sessionLabel
                        });
                    }
                }
            }
        }
        // Sort matches by smallest absolute delta |deltaMinutes|
        validMatches.sort((a, b) => Math.abs(a.deltaMinutes) - Math.abs(b.deltaMinutes));
        if (validMatches.length === 0) {
            return {
                success: false,
                notes: `No available slot within ±30m buffer in doctor's 1-hour sessions on ${dayOfWeek}`
            };
        }
        const best = validMatches[0];
        const newAppointmentTime = (0, appointment_utils_1.timeStringToDate)((0, appointment_utils_1.minutesToHHmm)(best.candidateStartMinutes));
        await this.appointmentRepository.lockDoctorSchedule(tx, best.schedule.schedule_id);
        const tokenNumber = await this.appointmentRepository.generateTokenNumber(tx, best.schedule.schedule_id, best.effectiveDate, replacementEmployeeId, newAppointmentTime);
        const doctorName = `${replacementEmployee.first_name} ${replacementEmployee.last_name}`.trim();
        const deltaStr = best.deltaMinutes === 0
            ? "Exact time"
            : best.deltaMinutes > 0
                ? `+${best.deltaMinutes}m buffer`
                : `${best.deltaMinutes}m buffer`;
        await this.repository.updateAppointment(tx, appointment.appointment_id, {
            employee_id: replacementEmployeeId,
            branch_id: targetBranchId,
            schedule_id: best.schedule.schedule_id,
            appointment_date: best.effectiveDate,
            appointment_time: newAppointmentTime,
            token_number: tokenNumber,
            doctor_name: doctorName,
            assigned_doctor: doctorName
        });
        return {
            success: true,
            scheduleId: best.schedule.schedule_id,
            notes: `Reassigned to Dr. ${doctorName} at ${(0, appointment_utils_1.minutesToHHmm)(best.candidateStartMinutes)} (${deltaStr} in 1-hr session ${best.sessionLabel})`
        };
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
        // Defense in depth: the destination must not be an active assignment
        // at confirm time either (a transfer there would be a no-op for the
        // destination while still closing the source branch). This only
        // applies to TRUE transfers, which always carry old_branch_id —
        // slot-level moves (ADD_BRANCH + close_schedule_ids, confirmed from
        // the Scheduled page without old_branch_id) legitimately target
        // branches the doctor is already assigned to.
        if (dto.old_branch_id) {
            const destinationMapping = await this.repository.findActiveBranchMapping(employeeId, transfer.new_branch_id, employee.user_id);
            if (destinationMapping) {
                throw new Error("Doctor is already assigned to the destination branch — no transfer is needed");
            }
        }
        let replacementEmployee = null;
        if (dto.action === doctorTransfer_constants_1.TRANSFER_ACTION.TRANSFER) {
            const hasPerApptTransfer = Array.isArray(dto.appointments) && dto.appointments.some((a) => a.action === doctorTransfer_constants_1.TRANSFER_ACTION.TRANSFER || (!a.action && !!a.replacement_employee_id));
            if (!dto.replacement_employee_id && !hasPerApptTransfer) {
                throw new Error("A replacement doctor is required for the TRANSFER action");
            }
            if (dto.replacement_employee_id) {
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
                replacementEmployee = {
                    employee_id: dto.replacement_employee_id,
                    first_name: replacement.first_name,
                    last_name: replacement.last_name,
                    department_id: replacement.department_id,
                    user_id: replacement.user_id
                };
            }
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
            // Recompute the closing set at confirm time instead of trusting
            // the initiate-time snapshot: schedules may have been edited (or
            // new ones added) between initiate and confirm, and the set of
            // affected appointments must match what is actually being closed
            // right now - otherwise bookings can be missed or schedules can
            // look "not transferred" after the transfer completes.
            // Split the stored snapshot: DATE_CHANGE transfers carry their
            // payload tagged inside new_schedule; everything else is treated
            // as normal working-hour entries (none for date changes).
            const snapshotEntries = (transfer.new_schedule ?? []);
            const metaEntry = snapshotEntries.find((e) => e && e.__meta === "TRANSFER_METADATA");
            const effectiveOldBranchId = dto.old_branch_id || metaEntry?.old_branch_id || null;
            const dateChangeEntry = snapshotEntries.find((e) => e && e.__type === "DATE_CHANGE");
            const workingSnapshot = snapshotEntries.filter((e) => !(e && (e.__type === "DATE_CHANGE" || e.__meta === "TRANSFER_METADATA")));
            const activeSchedulesNow = await this.repository.findAllActiveSchedulesInTx(tx, employeeId);
            const closingScheduleIdsNow = this.findConflictingSchedules(activeSchedulesNow, workingSnapshot).map((s) => s.schedule_id);
            // Rows explicitly requested at initiate time (slot-level moves
            // and close-only cancels) must still close even when a conflict
            // re-scan cannot rediscover them - a close-only cancel has an
            // empty new_schedule snapshot and therefore produces zero
            // conflicts on its own.
            const seenClosingIds = new Set(closingScheduleIdsNow.map((id) => id.toString()));
            for (const storedId of transfer.closing_schedule_ids ?? []) {
                const key = storedId.toString();
                if (!seenClosingIds.has(key)) {
                    seenClosingIds.add(key);
                    closingScheduleIdsNow.push(storedId);
                }
            }
            if (effectiveOldBranchId) {
                for (const schedule of activeSchedulesNow) {
                    if (schedule.branch_id === effectiveOldBranchId &&
                        !closingScheduleIdsNow.includes(schedule.schedule_id)) {
                        closingScheduleIdsNow.push(schedule.schedule_id);
                    }
                }
            }
            const closingSchedulesNow = closingScheduleIdsNow.length > 0
                ? await this.repository.findSchedulesByIds(tx, closingScheduleIdsNow)
                : [];
            const closingBranchIdsNow = Array.from(new Set(closingSchedulesNow.map((s) => s.branch_id)));
            if (effectiveOldBranchId) {
                closingBranchIdsNow.push(effectiveOldBranchId);
            }
            const appointments = await this.repository.findAllFutureAppointmentsForTransferByScheduleIds(tx, closingScheduleIdsNow, transfer.effective_date, {
                employeeId,
                branchIds: closingBranchIdsNow,
                includeAllAtBranches: !!effectiveOldBranchId
            });
            summary.total = appointments.length;
            const affectedDoctorDates = new Map();
            const trackDoctorDate = (empId, date) => {
                if (!empId || !date)
                    return;
                const key = `${empId}_${formatDateOnly(date)}`;
                if (!affectedDoctorDates.has(key)) {
                    affectedDoctorDates.set(key, { employee_id: empId, appointment_date: date });
                }
            };
            for (const appointment of appointments) {
                await this.repository.lockAppointment(tx, appointment.appointment_id);
                const perAppt = dto.appointments?.find((i) => i.appointment_id === appointment.appointment_id);
                const apptAction = perAppt?.action ?? dto.action;
                const replacementId = perAppt?.replacement_employee_id ?? dto.replacement_employee_id;
                const targetBranchId = perAppt?.replacement_branch_id ?? dto.replacement_branch_id ?? appointment.branch_id;
                const customTime = perAppt?.custom_time;
                if (apptAction === doctorTransfer_constants_1.TRANSFER_ACTION.TRANSFER) {
                    if (!replacementId) {
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
                            priority: dto.priority ?? "HIGH",
                            reason: dto.reason ?? transfer.transfer_reason ?? "Transfer unassigned - reschedule required",
                            status: doctorTransfer_constants_1.RESCHEDULE_QUEUE_STATUS.PENDING,
                            created_by: confirmedBy
                        });
                        await this.repository.createRescheduleActionLog(tx, {
                            queue_id: queueId,
                            action: doctorTransfer_constants_1.RESCHEDULE_QUEUE_ACTION.CREATED,
                            performed_by: confirmedBy,
                            notes: `Queued from doctor transfer ${transfer.transfer_id}`
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
                        continue;
                    }
                    const replDoc = replacementId === replacementEmployee?.employee_id
                        ? replacementEmployee
                        : await this.repository.findDoctorWithRole(replacementId);
                    const outcome = await this.transferSingleAppointment(tx, appointment, replacementId, replDoc, replDoc?.user_id, targetBranchId, customTime);
                    if (!outcome.success) {
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
                            priority: "HIGH",
                            reason: outcome.notes ? `Transfer conflict: ${outcome.notes}` : "Transfer conflict - reschedule required",
                            status: doctorTransfer_constants_1.RESCHEDULE_QUEUE_STATUS.PENDING,
                            created_by: confirmedBy
                        });
                        await this.repository.createRescheduleActionLog(tx, {
                            queue_id: queueId,
                            action: doctorTransfer_constants_1.RESCHEDULE_QUEUE_ACTION.CREATED,
                            performed_by: confirmedBy,
                            notes: `Queued from transfer conflict: ${outcome.notes}`
                        });
                        summary.queued += 1;
                        summary.conflicts += 1;
                        conflicts.push({ appointment_id: appointment.appointment_id, reason: outcome.notes });
                    }
                    else {
                        summary.successful += 1;
                        successful.push({ appointment_id: appointment.appointment_id, reason: outcome.notes });
                        trackDoctorDate(replacementId, appointment.appointment_date);
                        if (dto.notify_channels && dto.notify_channels.length > 0) {
                            for (const channel of dto.notify_channels) {
                                const notificationId = await this.repository.generateNotificationId(tx);
                                await this.repository.createNotification(tx, {
                                    notification_id: notificationId,
                                    appointment_id: appointment.appointment_id,
                                    channel,
                                    notification_type: "DOCTOR_TRANSFER_REASSIGNMENT",
                                    status: "PENDING"
                                });
                            }
                        }
                    }
                    trackDoctorDate(employeeId, appointment.appointment_date);
                    await this.repository.createTransferAppointmentLog(tx, {
                        transfer_id: transfer.transfer_id,
                        appointment_id: appointment.appointment_id,
                        action: doctorTransfer_constants_1.TRANSFER_ACTION.TRANSFER,
                        old_employee_id: employeeId,
                        old_branch_id: appointment.branch_id,
                        old_schedule_id: appointment.schedule_id,
                        old_appointment_date: appointment.appointment_date,
                        old_appointment_time: appointment.appointment_time,
                        new_employee_id: outcome.success ? replacementId : null,
                        new_branch_id: outcome.success ? targetBranchId : null,
                        new_schedule_id: outcome.success ? outcome.scheduleId : null,
                        result_status: outcome.success ? doctorTransfer_constants_1.APPOINTMENT_LOG_RESULT.SUCCESS : doctorTransfer_constants_1.APPOINTMENT_LOG_RESULT.CONFLICT,
                        notes: outcome.notes
                    });
                }
                else if (apptAction === doctorTransfer_constants_1.TRANSFER_ACTION.RESCHEDULE) {
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
                        reason: dto.reason?.trim() || transfer.transfer_reason || "Doctor transfer reschedule",
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
                    trackDoctorDate(employeeId, appointment.appointment_date);
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
                    trackDoctorDate(employeeId, appointment.appointment_date);
                    summary.cancelled += 1;
                }
            }
            if (effectiveOldBranchId) {
                // True transfer – close all remaining schedules on the source branch
                await this.applyDoctorTransfer(tx, {
                    employee_id: employeeId,
                    employee_user_id: employee.user_id,
                    employee_branch_id: employee.branch_id,
                    old_branch_id: effectiveOldBranchId,
                    new_branch_id: transfer.new_branch_id,
                    new_department_id: transfer.new_department_id,
                    effective_date: transfer.effective_date,
                    new_schedule: workingSnapshot,
                    closing_schedule_ids: closingScheduleIdsNow,
                    deletedBy: dto.action === doctorTransfer_constants_1.TRANSFER_ACTION.TRANSFER ? confirmedBy : null
                });
            }
            else {
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
            // Recalculate daily timeline for all affected doctors & dates
            for (const item of affectedDoctorDates.values()) {
                await this.appointmentService.recalculateDoctorDailyTimeline(tx, item.employee_id, item.appointment_date);
            }
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
            if (queue.status !== doctorTransfer_constants_1.RESCHEDULE_QUEUE_STATUS.PENDING && queue.status !== doctorTransfer_constants_1.RESCHEDULE_QUEUE_STATUS.ASSIGNED) {
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
            const requestedMinutes = (0, appointment_utils_1.timeStringToMinutes)(dto.appointment_time);
            let schedule = null;
            // 1. Direct Schedule ID resolution if passed from slot selector
            if (dto.schedule_id) {
                schedule = await this.appointmentRepository.findDoctorScheduleById(dto.schedule_id);
                if (schedule && schedule.employee_id !== dto.employee_id) {
                    throw new Error("Schedule does not belong to the selected doctor");
                }
            }
            // 2. Fallback to Day-of-Week matching (supporting overnight shifts)
            if (!schedule) {
                const schedules = await this.appointmentRepository.findActiveDoctorSchedules(dto.employee_id, dto.branch_id, dayOfWeek);
                // If not found or early morning, also check yesterday's overnight schedules
                const prevDay = (0, appointment_utils_1.toDayOfWeek)((0, appointment_utils_1.addDays)(appointmentDate, -1));
                const yesterdaySchedules = await this.appointmentRepository.findActiveDoctorSchedules(dto.employee_id, dto.branch_id, prevDay);
                const candidateSchedules = [...schedules, ...yesterdaySchedules];
                schedule = candidateSchedules.find((s) => {
                    if (!s.start_time || !s.end_time)
                        return false;
                    const sStart = (0, appointment_utils_1.timeToMinutes)(s.start_time);
                    let sEnd = (0, appointment_utils_1.timeToMinutes)(s.end_time);
                    if (sEnd <= sStart)
                        sEnd += 1440;
                    let reqMin = requestedMinutes;
                    if (reqMin < sStart && sEnd > 1440)
                        reqMin += 1440;
                    return reqMin >= sStart && reqMin < sEnd;
                });
            }
            if (!schedule) {
                throw new Error("Selected time is outside the doctor's working hours");
            }
            const appointmentTime = (0, appointment_utils_1.timeStringToDate)(dto.appointment_time);
            // Elastic Collision Check
            const existingAppts = await this.appointmentRepository.findBookedAppointmentsForDate(dto.employee_id, appointmentDate);
            // Also check overnight if shift spans past midnight
            const schedStart = schedule.start_time ? (0, appointment_utils_1.timeToMinutes)(schedule.start_time) : 0;
            const schedEnd = schedule.end_time ? (0, appointment_utils_1.timeToMinutes)(schedule.end_time) : 0;
            if (schedEnd <= schedStart) {
                const nextDayAppts = await this.appointmentRepository.findBookedAppointmentsForDate(dto.employee_id, (0, appointment_utils_1.addDays)(appointmentDate, 1));
                existingAppts.push(...nextDayAppts);
            }
            const targetAppt = await prisma_1.default.appointment_history.findUnique({
                where: { appointment_id: appointmentId },
                select: { duration_minutes: true }
            });
            const duration = targetAppt?.duration_minutes ?? 10;
            const reqStart = requestedMinutes;
            const reqEnd = reqStart + duration;
            const overlaps = existingAppts.some((b) => {
                if (b.appointment_id === appointmentId)
                    return false;
                if (b.status === appointment_constants_1.APPOINTMENT_STATUS.CANCELLED || b.status === appointment_constants_1.APPOINTMENT_STATUS.NO_SHOW || !b.appointment_time)
                    return false;
                const bStart = (0, appointment_utils_1.timeToMinutes)(b.appointment_time);
                const bEnd = bStart + (b.duration_minutes ?? 10);
                return reqStart < bEnd && reqEnd > bStart;
            });
            if (overlaps) {
                throw new Error("Selected time overlaps with an existing consultation for this doctor");
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
                const tokenNumber = await this.appointmentRepository.generateTokenNumber(tx, queue.assigned_schedule_id, queue.assigned_date, queue.assigned_employee_id, queue.assigned_time);
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
                if (queue.assigned_employee_id && queue.assigned_date) {
                    await this.appointmentService.recalculateDoctorDailyTimeline(tx, queue.assigned_employee_id, queue.assigned_date);
                }
                if (queue.employee_id && queue.old_appointment_date) {
                    await this.appointmentService.recalculateDoctorDailyTimeline(tx, queue.employee_id, queue.old_appointment_date);
                }
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
            if (queue.employee_id && (queue.old_appointment_date || queue.assigned_date)) {
                await this.appointmentService.recalculateDoctorDailyTimeline(tx, queue.employee_id, (queue.old_appointment_date || queue.assigned_date));
            }
            await this.repository.createRescheduleActionLog(tx, {
                queue_id: queue.queue_id,
                action: doctorTransfer_constants_1.RESCHEDULE_QUEUE_ACTION.CANCELLED,
                performed_by: performedBy,
                notes: dto.reason
            });
            return { queue_id: queue.queue_id, status: doctorTransfer_constants_1.RESCHEDULE_QUEUE_STATUS.CANCELLED };
        });
    }
    async getDoctorPendingTransfer(employeeId) {
        await this.resolveDoctor(employeeId);
        const today = todayDateOnly();
        await this.repository.expireStalePendingTransfers(today, employeeId);
        const pending = await this.repository.getActivePendingTransfer(employeeId);
        if (!pending) {
            return null;
        }
        const closingScheduleIds = (pending.closing_schedule_ids || []);
        const snapshotEntries = (pending.new_schedule ?? []);
        const metaEntry = snapshotEntries.find((e) => e && e.__meta === "TRANSFER_METADATA");
        const dateChangeEntry = snapshotEntries.find((e) => e && e.__type === "DATE_CHANGE");
        const storedOldBranchId = metaEntry?.old_branch_id;
        let sourceBranchIds = [];
        if (closingScheduleIds.length > 0) {
            const closingSchedules = await this.repository.findSchedulesByIds(prisma_1.default, closingScheduleIds);
            sourceBranchIds = Array.from(new Set(closingSchedules.map((s) => s.branch_id)));
        }
        if (storedOldBranchId && !sourceBranchIds.includes(storedOldBranchId)) {
            sourceBranchIds.push(storedOldBranchId);
        }
        let appointments = [];
        if (dateChangeEntry) {
            const changeDate = (0, appointment_utils_1.parseDateOnly)(dateChangeEntry.change_date);
            const weekday = (0, appointment_utils_1.toDayOfWeek)(changeDate);
            const impact = await this.repository.fetchDataForDateChangeImpact(employeeId, dateChangeEntry.branch_id, changeDate, dateChangeEntry.change_id ? BigInt(dateChangeEntry.change_id) : undefined);
            const proposed = [];
            if (dateChangeEntry.action === "CREATE" || dateChangeEntry.action === "UPDATE") {
                proposed.push({
                    mode: dateChangeEntry.mode,
                    start_time: dateChangeEntry.start_time ? (0, appointment_utils_1.timeStringToDate)(dateChangeEntry.start_time) : null,
                    end_time: dateChangeEntry.end_time ? (0, appointment_utils_1.timeStringToDate)(dateChangeEntry.end_time) : null
                });
            }
            const afterWindows = this.buildDateWindows(weekday, impact.templateSchedules, [
                ...impact.changes.map((chg) => ({
                    mode: chg.mode,
                    start_time: chg.start_time,
                    end_time: chg.end_time
                })),
                ...proposed
            ]);
            const dayAppointments = await this.repository.findDayAppointments(employeeId, dateChangeEntry.branch_id, changeDate);
            appointments = dayAppointments.filter((appt) => {
                if (!appt.appointment_time)
                    return false;
                const t = (0, appointment_utils_1.timeToMinutes)(appt.appointment_time);
                return !afterWindows.some((w) => t >= w.s && t < w.e);
            });
        }
        else {
            appointments = await this.repository.findAllFutureAppointmentsForTransferByScheduleIds(prisma_1.default, closingScheduleIds, pending.effective_date, {
                employeeId,
                branchIds: sourceBranchIds,
                includeAllAtBranches: Boolean(storedOldBranchId)
            });
        }
        const appointmentsWithCandidates = await Promise.all(appointments.map(async (appointment) => ({
            ...this.mapAppointmentSummary(appointment),
            eligible_replacement_doctors: await this.findEligibleReplacementDoctors(appointment.branch_id, pending.old_department_id, employeeId, (0, appointment_utils_1.toDayOfWeek)(appointment.appointment_date), appointment.appointment_time)
        })));
        return {
            transfer_id: pending.transfer_id,
            employee_id: pending.employee_id,
            status: pending.status,
            old_branch_id: storedOldBranchId || undefined,
            new_branch_id: pending.new_branch_id,
            branch_name: pending.branch?.branch_name,
            old_department_id: pending.old_department_id,
            new_department_id: pending.new_department_id,
            effective_date: formatDateOnly(pending.effective_date),
            transfer_reason: pending.transfer_reason,
            affected_appointment_count: appointments.length,
            appointments: appointmentsWithCandidates,
            actions_required: doctorTransfer_constants_1.TRANSFER_ACTION_VALUES
        };
    }
    async discardTransfer(employeeId, transferId, actingUserId, reason) {
        await this.resolveDoctor(employeeId);
        const transfer = await this.repository.getDoctorTransferById(transferId);
        if (!transfer) {
            throw new Error("Transfer request not found");
        }
        if (transfer.employee_id !== employeeId) {
            throw new Error("Transfer request does not belong to this doctor");
        }
        if (transfer.status !== doctorTransfer_constants_1.TRANSFER_STATUS.PENDING_CONFIRMATION) {
            throw new Error(`Cannot discard a transfer with status: ${transfer.status}`);
        }
        const discarded = await this.repository.discardPendingTransfer(transferId, actingUserId, reason);
        return {
            transfer_id: discarded.transfer_id,
            status: discarded.status,
            message: `Transfer ${transferId} has been discarded and doctor is now unblocked.`
        };
    }
}
exports.DoctorTransferService = DoctorTransferService;
