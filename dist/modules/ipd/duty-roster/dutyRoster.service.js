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
class DutyRosterService {
    repository;
    constructor(repository = new dutyRoster_repository_1.DutyRosterRepository()) {
        this.repository = repository;
    }
    // -------------------------------------------------------------
    // 1. Available Staff Query (Mode B - Strict Roster-Guided)
    // -------------------------------------------------------------
    async getAvailableStaff(params) {
        const { branchId, dutyDate, shiftCode, roleInDuty, includeAllBranch } = params;
        if (!branchId || !dutyDate || !shiftCode || !roleInDuty) {
            throw new Error("branchId, dutyDate, shiftCode, and roleInDuty are required");
        }
        const targetDate = new Date(dutyDate);
        if (isNaN(targetDate.getTime())) {
            throw new Error("Invalid dutyDate format (expected YYYY-MM-DD)");
        }
        const dayOfWeek = DAYS_OF_WEEK[targetDate.getUTCDay()];
        // 1. Fetch weekly templates for this day and shift
        const templates = await this.repository.getTemplatesForDayAndShift(branchId, dayOfWeek, shiftCode, roleInDuty);
        // 2. Fetch specific date roster entries
        const dateEntries = await this.repository.getRosterEntriesForDate(branchId, targetDate, shiftCode, roleInDuty);
        // 3. Merge: specific date entries override templates for the same employee
        const staffMap = new Map();
        for (const t of templates) {
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
    // -------------------------------------------------------------
    // 2. Branch Shift Configurations
    // -------------------------------------------------------------
    async getBranchShifts(branchId) {
        if (!branchId)
            throw new Error("branchId is required");
        return this.repository.getBranchShifts(branchId);
    }
    async createBranchShift(data) {
        if (!data.branch_id || !data.shift_code || !data.shift_name || !data.start_time || !data.end_time) {
            throw new Error("Missing required branch shift fields");
        }
        return prisma_1.default.$transaction(async (tx) => {
            const shiftId = await (0, idGenerator_1.generateId)(tx, "BRANCH_SHIFT");
            return this.repository.createBranchShift(data, shiftId);
        });
    }
    async updateBranchShift(shiftId, data) {
        if (!shiftId)
            throw new Error("shiftId is required");
        return this.repository.updateBranchShift(shiftId, data);
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
        return prisma_1.default.$transaction(async (tx) => {
            const templateId = await (0, idGenerator_1.generateId)(tx, "DUTY_TEMPLATE");
            return this.repository.upsertTemplate(data, templateId, actorUserId);
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
        const fromDate = new Date(fromDateStr);
        const toDate = new Date(toDateStr);
        return this.repository.getRosterEntriesRange(branchId, fromDate, toDate);
    }
    async upsertRosterEntry(data, actorUserId) {
        if (!data.employee_id || !data.branch_id || !data.duty_date || !data.shift_code || !data.role_in_duty) {
            throw new Error("Missing required roster fields");
        }
        return prisma_1.default.$transaction(async (tx) => {
            const rosterId = await (0, idGenerator_1.generateId)(tx, "DUTY_ROSTER");
            return this.repository.upsertRosterEntry(data, rosterId, actorUserId);
        });
    }
    async deleteRosterEntry(rosterId) {
        if (!rosterId)
            throw new Error("rosterId is required");
        return this.repository.deleteRosterEntry(rosterId);
    }
}
exports.DutyRosterService = DutyRosterService;
