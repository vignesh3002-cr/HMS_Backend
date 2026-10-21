"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DutyRosterService = void 0;
const prisma_1 = __importDefault(require("../../../config/prisma"));
const idGenerator_1 = require("../../../utils/idGenerator");
const dutyRoster_repository_1 = require("./dutyRoster.repository");
const DAYS_OF_WEEK = [
    "SUNDAY",
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
];
const ROLE_FOR_DUTY = { DUTY_DOCTOR: "DOCTOR", DUTY_NURSE: "NURSE" };
const MAX_ROSTER_RANGE_DAYS = 62;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MINUTES_PER_DAY = 24 * 60;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Reject anything that is not HH:mm[:ss] (or a valid ISO datetime). */
function assertValidTime(value, label) {
    if (typeof value !== "string")
        throw new Error(`${label} is required (HH:mm)`);
    const v = value.trim();
    if (v.includes("T")) {
        if (isNaN(new Date(v).getTime()))
            throw new Error(`Invalid ${label}: '${value}'`);
        return;
    }
    if (!TIME_RE.test(v))
        throw new Error(`Invalid ${label}: '${value}' (expected HH:mm)`);
}
function timeToMinutes(value) {
    if (value instanceof Date)
        return value.getUTCHours() * 60 + value.getUTCMinutes();
    const v = value.trim();
    if (v.includes("T")) {
        const d = new Date(v);
        return d.getUTCHours() * 60 + d.getUTCMinutes();
    }
    const [h, m] = v.split(":");
    return Number(h) * 60 + Number(m);
}
/** Parse a strict YYYY-MM-DD string into a UTC-midnight Date. */
function parseDateOnly(value, label) {
    if (typeof value !== "string" || !DATE_RE.test(value.trim())) {
        throw new Error(`Invalid ${label}: expected YYYY-MM-DD`);
    }
    const d = new Date(`${value.trim()}T00:00:00.000Z`);
    if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value.trim()) {
        throw new Error(`Invalid ${label}: '${value}'`);
    }
    return d;
}
/** Today's calendar date in IST, as a UTC-midnight Date. */
function istTodayDate() {
    return new Date(new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10) + "T00:00:00.000Z");
}
/** Absolute [start, end) minutes of a shift placed `dayOffset` days from a reference day. */
function shiftInterval(start, end, dayOffset) {
    const s = timeToMinutes(start);
    let e = timeToMinutes(end);
    if (e <= s)
        e += MINUTES_PER_DAY; // overnight shift
    const base = dayOffset * MINUTES_PER_DAY;
    return { start: base + s, end: base + e };
}
const intervalsOverlap = (a, b) => a.start < b.end && b.start < a.end;
class DutyRosterService {
    repository;
    constructor(repository = new dutyRoster_repository_1.DutyRosterRepository()) {
        this.repository = repository;
    }
    /** Employee must exist, be active, hold the matching role and work at the branch. */
    async assertRosterable(employeeId, branchId, roleInDuty) {
        const requiredRole = ROLE_FOR_DUTY[roleInDuty];
        if (!requiredRole)
            throw new Error("role_in_duty must be DUTY_DOCTOR or DUTY_NURSE");
        const emp = await this.repository.getEmployeeForRoster(employeeId);
        if (!emp || emp.deleted_at || !emp.emp_status) {
            throw new Error("Employee not found or inactive");
        }
        if (String(emp.user_table?.role_type ?? "").toUpperCase() !== requiredRole) {
            throw new Error(`Employee is not a ${requiredRole} and cannot be rostered as ${roleInDuty}`);
        }
        if (!emp.user_branch_mapping.some((m) => m.branch_id === branchId)) {
            throw new Error("Employee is not mapped to this branch");
        }
    }
    /** The shift must exist and be active for the branch. */
    async requireActiveShift(branchId, shiftCode) {
        const shift = await this.repository.getBranchShiftByCode(branchId, shiftCode);
        if (!shift || !shift.is_active) {
            throw new Error(`Shift '${shiftCode}' is not configured or inactive for this branch`);
        }
        return shift;
    }
    // -------------------------------------------------------------
    // 1. Available Staff Query (Mode B - Strict Roster-Guided)
    // -------------------------------------------------------------
    async getAvailableStaff(params) {
        const { branchId, dutyDate, roleInDuty, includeAllBranch } = params;
        if (!branchId || !dutyDate || !params.shiftCode || !roleInDuty) {
            throw new Error("branchId, dutyDate, shiftCode, and roleInDuty are required");
        }
        if (!(roleInDuty in ROLE_FOR_DUTY)) {
            throw new Error("roleInDuty must be DUTY_DOCTOR or DUTY_NURSE");
        }
        const shiftCode = params.shiftCode.trim().toUpperCase();
        const targetDate = parseDateOnly(dutyDate, "dutyDate");
        const dayOfWeek = DAYS_OF_WEEK[targetDate.getUTCDay()];
        // 1. Fetch weekly templates for this day and shift (within their effective window)
        const templates = await this.repository.getTemplatesForDayAndShift(branchId, dayOfWeek, shiftCode, roleInDuty, targetDate);
        // 2. Fetch specific date roster entries
        const dateEntries = await this.repository.getRosterEntriesForDate(branchId, targetDate, shiftCode, roleInDuty);
        // 3. Merge: if the date has explicit entries for this shift/role they REPLACE
        //    the weekly template (same rule the roster grid shows); otherwise the
        //    template applies.
        const staffMap = new Map();
        for (const t of dateEntries.length > 0 ? [] : templates) {
            if (t.employees) {
                staffMap.set(t.employee_id, {
                    employee: t.employees,
                    shift_code: t.shift_code,
                    source: "TEMPLATE",
                });
            }
        }
        for (const r of dateEntries) {
            if (r.employees) {
                staffMap.set(r.employee_id, {
                    employee: r.employees,
                    shift_code: r.shift_code,
                    source: "ROSTER",
                });
            }
        }
        const candidateIds = [...staffMap.keys()];
        // 4. Check approved leaves on this date
        const onLeave = await this.repository.getApprovedLeaves(candidateIds, targetDate);
        // 5. Filter out employees on approved leave
        const availableCandidates = candidateIds.filter((id) => !onLeave.has(id));
        // 6. Get active patient load for these employees
        const activeCounts = await this.repository.getActivePatientCounts(availableCandidates);
        const rosteredResult = availableCandidates.map((id) => {
            const entry = staffMap.get(id);
            const emp = entry.employee;
            const roleType = emp.user_table?.role_type || (roleInDuty === "DUTY_DOCTOR" ? "DOCTOR" : "NURSE");
            return {
                employee_id: emp.employee_id || id,
                first_name: emp.first_name,
                middle_name: emp.middle_name,
                last_name: emp.last_name,
                role_type: roleType,
                specialization: emp.specialization,
                shift_code: entry.shift_code,
                source: entry.source,
                active_patients_count: activeCounts[id] || 0,
            };
        });
        // 7. If emergency override is requested, also append other branch staff who are not on leave
        if (includeAllBranch) {
            const roleType = roleInDuty === "DUTY_DOCTOR" ? "DOCTOR" : "NURSE";
            const allBranch = await this.repository.getAllBranchStaffByRole(branchId, roleType);
            const validBranchStaff = allBranch.filter((b) => Boolean(b.employee_id));
            const allIds = validBranchStaff.map((b) => b.employee_id);
            const allLeaves = await this.repository.getApprovedLeaves(allIds, targetDate);
            const unrosteredIds = allIds.filter((id) => !staffMap.has(id) && !allLeaves.has(id));
            const unrosteredCounts = await this.repository.getActivePatientCounts(unrosteredIds);
            for (const emp of validBranchStaff) {
                if (unrosteredIds.includes(emp.employee_id)) {
                    rosteredResult.push({
                        employee_id: emp.employee_id,
                        first_name: emp.first_name,
                        middle_name: emp.middle_name,
                        last_name: emp.last_name,
                        role_type: emp.user_table?.role_type || roleType,
                        specialization: emp.specialization,
                        shift_code: shiftCode,
                        source: "OVERRIDE",
                        active_patients_count: unrosteredCounts[emp.employee_id] || 0,
                    });
                }
            }
        }
        return rosteredResult;
    }
    /**
     * Is `employeeId` rostered for a shift that covers `at` (IST)?
     *
     * `enforced` is false when the branch has no roster or weekly template for
     * that role at all -- there is nothing to check against, so callers should
     * not block anyone. Overnight shifts count on the day they started, so at
     * 02:00 the previous evening's NIGHT roster is the one in force. Explicit
     * date entries replace the weekly template for the same shift, exactly as
     * the availability query does.
     */
    async checkOnDuty(branchId, employeeId, roleInDuty, at = new Date()) {
        const DAY_MS = MINUTES_PER_DAY * 60 * 1000;
        const ist = new Date(at.getTime() + IST_OFFSET_MS);
        const today = new Date(ist.toISOString().slice(0, 10) + "T00:00:00.000Z");
        const yesterday = new Date(today.getTime() - DAY_MS);
        const nowMin = ist.getUTCHours() * 60 + ist.getUTCMinutes();
        const [rosterCount, templateCount] = await Promise.all([
            prisma_1.default.staff_duty_roster.count({
                where: { branch_id: branchId, role_in_duty: roleInDuty, is_active: true, duty_date: { gte: yesterday } },
            }),
            prisma_1.default.staff_duty_roster_template.count({
                where: { branch_id: branchId, role_in_duty: roleInDuty, is_active: true },
            }),
        ]);
        if (rosterCount + templateCount === 0)
            return { enforced: false, onDuty: true };
        const entries = await prisma_1.default.staff_duty_roster.findMany({
            where: {
                branch_id: branchId,
                role_in_duty: roleInDuty,
                is_active: true,
                duty_date: { gte: yesterday, lte: today },
            },
            select: { employee_id: true, duty_date: true, shift_code: true, start_time: true, end_time: true },
        });
        const covers = (start, end, offset) => {
            const iv = shiftInterval(start, end, offset);
            return nowMin >= iv.start && nowMin < iv.end;
        };
        // Shifts (per date) that have explicit entries and so shadow the template.
        const shadowed = new Set(entries.map((e) => `${e.duty_date.toISOString().slice(0, 10)}|${e.shift_code}`));
        for (const e of entries) {
            if (e.employee_id !== employeeId)
                continue;
            const offset = e.duty_date.getTime() === today.getTime() ? 0 : -1;
            if (covers(e.start_time, e.end_time, offset))
                return { enforced: true, onDuty: true };
        }
        const templates = await prisma_1.default.staff_duty_roster_template.findMany({
            where: {
                employee_id: employeeId,
                branch_id: branchId,
                role_in_duty: roleInDuty,
                is_active: true,
                day_of_week: { in: [DAYS_OF_WEEK[yesterday.getUTCDay()], DAYS_OF_WEEK[today.getUTCDay()]] },
            },
            select: {
                day_of_week: true, shift_code: true, start_time: true, end_time: true,
                effective_from: true, effective_to: true,
            },
        });
        for (const t of templates) {
            for (const [date, offset] of [[today, 0], [yesterday, -1]]) {
                if (t.day_of_week !== DAYS_OF_WEEK[date.getUTCDay()])
                    continue;
                if (shadowed.has(`${date.toISOString().slice(0, 10)}|${t.shift_code}`))
                    continue;
                if (t.effective_from && t.effective_from > date)
                    continue;
                if (t.effective_to && t.effective_to < date)
                    continue;
                if (covers(t.start_time, t.end_time, offset))
                    return { enforced: true, onDuty: true };
            }
        }
        return { enforced: true, onDuty: false };
    }
    // -------------------------------------------------------------
    // 2. Branch Shift Configurations
    // -------------------------------------------------------------
    async getBranchShifts(branchId) {
        if (!branchId)
            throw new Error("branchId is required");
        const shifts = await this.repository.getBranchShifts(branchId);
        if (shifts.length > 0)
            return shifts;
        // A branch created after the migration has no shifts, which would leave
        // the roster, the nurse duty pattern and the care-team picker empty.
        // Provision the same default set the migration seeds (idempotent: fixed
        // ids + skipDuplicates), so every active branch is usable straight away.
        // Any existing branch qualifies (not only Active ones): shift rows are
        // plain configuration, and an admin whose home branch is inactive would
        // otherwise land on a permanently empty roster page.
        const branch = await prisma_1.default.branch.findUnique({
            where: { branch_id: branchId },
            select: { branch_id: true },
        });
        if (!branch)
            return shifts;
        const at = (hhmm) => new Date(`1970-01-01T${hhmm}:00.000Z`);
        const defaults = [
            { key: "MORN", code: "MORNING", name: "Morning Shift", start: "07:00", end: "15:00", overnight: false },
            { key: "EVE", code: "EVENING", name: "Evening Shift", start: "15:00", end: "23:00", overnight: false },
            { key: "NGT", code: "NIGHT", name: "Night Shift", start: "23:00", end: "07:00", overnight: true },
            { key: "GEN", code: "GENERAL", name: "General Duty", start: "09:00", end: "17:00", overnight: false },
        ];
        await prisma_1.default.branch_shift_master.createMany({
            data: defaults.map((d, i) => ({
                shift_id: `BSM-${branchId}-${d.key}`,
                branch_id: branchId,
                shift_code: d.code,
                shift_name: d.name,
                start_time: at(d.start),
                end_time: at(d.end),
                is_overnight: d.overnight,
                display_order: i + 1,
                is_active: true,
            })),
            skipDuplicates: true,
        });
        return this.repository.getBranchShifts(branchId);
    }
    async createBranchShift(data) {
        if (!data.branch_id || !data.shift_code || !data.shift_name || !data.start_time || !data.end_time) {
            throw new Error("Missing required branch shift fields");
        }
        assertValidTime(data.start_time, "start_time");
        assertValidTime(data.end_time, "end_time");
        if (timeToMinutes(data.start_time) === timeToMinutes(data.end_time)) {
            throw new Error("Shift start_time and end_time cannot be equal");
        }
        const shiftCode = data.shift_code.trim().toUpperCase();
        if (!/^[A-Z0-9_]{1,50}$/.test(shiftCode)) {
            throw new Error("shift_code may only contain letters, digits and underscores");
        }
        // is_overnight is derived from the times, never trusted from the client.
        const normalized = {
            ...data,
            shift_code: shiftCode,
            is_overnight: timeToMinutes(data.end_time) < timeToMinutes(data.start_time),
        };
        return prisma_1.default.$transaction(async (tx) => {
            const shiftId = await (0, idGenerator_1.generateId)(tx, "BRANCH_SHIFT");
            return this.repository.createBranchShift(normalized, shiftId);
        });
    }
    async updateBranchShift(shiftId, data) {
        if (!shiftId)
            throw new Error("shiftId is required");
        const existing = await prisma_1.default.branch_shift_master.findUnique({ where: { shift_id: shiftId } });
        if (!existing)
            throw new Error("Shift not found");
        const timesChanged = Boolean(data.start_time || data.end_time);
        let payload = data;
        if (timesChanged) {
            if (data.start_time)
                assertValidTime(data.start_time, "start_time");
            if (data.end_time)
                assertValidTime(data.end_time, "end_time");
            const start = data.start_time ?? existing.start_time;
            const end = data.end_time ?? existing.end_time;
            if (timeToMinutes(start) === timeToMinutes(end)) {
                throw new Error("Shift start_time and end_time cannot be equal");
            }
            payload = { ...data, is_overnight: timeToMinutes(end) < timeToMinutes(start) };
        }
        const updated = await this.repository.updateBranchShift(shiftId, payload);
        // Keep the times copied onto upcoming roster rows / templates in sync.
        if (timesChanged) {
            await prisma_1.default.$transaction([
                prisma_1.default.staff_duty_roster.updateMany({
                    where: {
                        branch_id: existing.branch_id,
                        shift_code: existing.shift_code,
                        duty_date: { gte: istTodayDate() },
                    },
                    data: { start_time: updated.start_time, end_time: updated.end_time },
                }),
                prisma_1.default.staff_duty_roster_template.updateMany({
                    where: { branch_id: existing.branch_id, shift_code: existing.shift_code },
                    data: { start_time: updated.start_time, end_time: updated.end_time },
                }),
            ]);
        }
        return updated;
    }
    // -------------------------------------------------------------
    // 3. Weekly Templates
    // -------------------------------------------------------------
    async getTemplates(branchId) {
        if (!branchId)
            throw new Error("branchId is required");
        return this.repository.getTemplates(branchId);
    }
    async upsertTemplate(data, actorUserId) {
        if (!data.employee_id || !data.branch_id || !data.day_of_week || !data.shift_code || !data.role_in_duty) {
            throw new Error("Missing required template fields");
        }
        const dayOfWeek = data.day_of_week.trim().toUpperCase();
        const dayIndex = DAYS_OF_WEEK.indexOf(dayOfWeek);
        if (dayIndex < 0)
            throw new Error("Invalid day_of_week");
        const shiftCode = data.shift_code.trim().toUpperCase();
        if (data.effective_from)
            parseDateOnly(data.effective_from, "effective_from");
        if (data.effective_to)
            parseDateOnly(data.effective_to, "effective_to");
        if (data.effective_from && data.effective_to && data.effective_to < data.effective_from) {
            throw new Error("effective_to cannot be before effective_from");
        }
        await this.assertRosterable(data.employee_id, data.branch_id, data.role_in_duty);
        const shift = await this.requireActiveShift(data.branch_id, shiftCode);
        // No overlapping weekly shifts for the same person (any branch), including
        // overnight spill-over from the previous day into this one.
        const mine = shiftInterval(shift.start_time, shift.end_time, 0);
        const others = await prisma_1.default.staff_duty_roster_template.findMany({
            where: { employee_id: data.employee_id, is_active: true },
            select: { branch_id: true, day_of_week: true, shift_code: true, role_in_duty: true, start_time: true, end_time: true },
        });
        for (const o of others) {
            const sameSlot = o.branch_id === data.branch_id &&
                o.day_of_week === dayOfWeek &&
                o.shift_code === shiftCode &&
                o.role_in_duty === data.role_in_duty;
            if (sameSlot)
                continue;
            const oIndex = DAYS_OF_WEEK.indexOf(o.day_of_week);
            if (oIndex < 0)
                continue;
            let offset = oIndex - dayIndex;
            if (offset > 3)
                offset -= 7;
            if (offset < -3)
                offset += 7;
            if (intervalsOverlap(mine, shiftInterval(o.start_time, o.end_time, offset))) {
                throw new Error(`Overlaps the employee's existing ${o.shift_code} shift on ${o.day_of_week}`);
            }
        }
        const normalized = {
            ...data,
            day_of_week: dayOfWeek,
            shift_code: shiftCode,
            // times always come from the shift definition, not the client
            start_time: undefined,
            end_time: undefined,
        };
        return prisma_1.default.$transaction(async (tx) => {
            const templateId = await (0, idGenerator_1.generateId)(tx, "DUTY_TEMPLATE");
            return this.repository.upsertTemplate(normalized, templateId, actorUserId);
        });
    }
    async deleteTemplate(templateId) {
        if (!templateId)
            throw new Error("templateId is required");
        return this.repository.deleteTemplate(templateId);
    }
    // -------------------------------------------------------------
    // 4. Specific Date Roster Entries
    // -------------------------------------------------------------
    async getRosterRange(branchId, fromDateStr, toDateStr) {
        if (!branchId || !fromDateStr || !toDateStr) {
            throw new Error("branchId, fromDate, and toDate are required");
        }
        const fromDate = parseDateOnly(fromDateStr, "fromDate");
        const toDate = parseDateOnly(toDateStr, "toDate");
        if (fromDate > toDate)
            throw new Error("fromDate cannot be after toDate");
        const days = (toDate.getTime() - fromDate.getTime()) / (MINUTES_PER_DAY * 60 * 1000);
        if (days > MAX_ROSTER_RANGE_DAYS) {
            throw new Error(`Date range cannot exceed ${MAX_ROSTER_RANGE_DAYS} days`);
        }
        return this.repository.getRosterEntriesRange(branchId, fromDate, toDate);
    }
    async upsertRosterEntry(data, actorUserId) {
        if (!data.employee_id || !data.branch_id || !data.duty_date || !data.shift_code || !data.role_in_duty) {
            throw new Error("Missing required roster fields");
        }
        const dutyDate = parseDateOnly(data.duty_date, "duty_date");
        if (dutyDate < istTodayDate()) {
            throw new Error("Cannot roster staff for a past date");
        }
        const shiftCode = data.shift_code.trim().toUpperCase();
        await this.assertRosterable(data.employee_id, data.branch_id, data.role_in_duty);
        const shift = await this.requireActiveShift(data.branch_id, shiftCode);
        // No overlapping duties for the same person on any branch, including an
        // overnight shift that started yesterday or runs into tomorrow.
        const DAY_MS = MINUTES_PER_DAY * 60 * 1000;
        const mine = shiftInterval(shift.start_time, shift.end_time, 0);
        const nearby = await this.repository.getEmployeeRosterBetween(data.employee_id, new Date(dutyDate.getTime() - DAY_MS), new Date(dutyDate.getTime() + DAY_MS));
        for (const o of nearby) {
            const sameSlot = o.branch_id === data.branch_id &&
                o.duty_date.getTime() === dutyDate.getTime() &&
                o.shift_code === shiftCode &&
                o.role_in_duty === data.role_in_duty;
            if (sameSlot)
                continue;
            const offset = Math.round((o.duty_date.getTime() - dutyDate.getTime()) / DAY_MS);
            if (intervalsOverlap(mine, shiftInterval(o.start_time, o.end_time, offset))) {
                throw new Error(`Overlaps the employee's ${o.shift_code} duty on ${o.duty_date.toISOString().slice(0, 10)}`);
            }
        }
        const normalized = {
            ...data,
            duty_date: data.duty_date.trim(),
            shift_code: shiftCode,
            // times always come from the shift definition, not the client
            start_time: undefined,
            end_time: undefined,
        };
        return prisma_1.default.$transaction(async (tx) => {
            const rosterId = await (0, idGenerator_1.generateId)(tx, "DUTY_ROSTER");
            return this.repository.upsertRosterEntry(normalized, rosterId, actorUserId);
        });
    }
    async deleteRosterEntry(rosterId) {
        if (!rosterId)
            throw new Error("rosterId is required");
        return this.repository.deleteRosterEntry(rosterId);
    }
}
exports.DutyRosterService = DutyRosterService;
