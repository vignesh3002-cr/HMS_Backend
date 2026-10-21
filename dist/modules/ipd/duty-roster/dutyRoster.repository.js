"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DutyRosterRepository = void 0;
const prisma_1 = __importDefault(require("../../../config/prisma"));
function parseSqlTime(val) {
    if (!val)
        return new Date("1970-01-01T00:00:00.000Z");
    if (val instanceof Date)
        return isNaN(val.getTime()) ? new Date("1970-01-01T00:00:00.000Z") : val;
    if (typeof val === "string") {
        const trimmed = val.trim();
        if (trimmed.includes("T")) {
            const d = new Date(trimmed);
            if (!isNaN(d.getTime()))
                return d;
        }
        const timePart = trimmed.length === 5 ? trimmed + ":00" : trimmed;
        const d = new Date(`1970-01-01T${timePart}Z`);
        if (!isNaN(d.getTime()))
            return d;
    }
    return new Date("1970-01-01T00:00:00.000Z");
}
class DutyRosterRepository {
    // -------------------------------------------------------------
    // 1. Branch Shifts
    // -------------------------------------------------------------
    async getBranchShifts(branchId) {
        return prisma_1.default.branch_shift_master.findMany({
            where: { branch_id: branchId },
            orderBy: [{ display_order: "asc" }, { shift_code: "asc" }],
        });
    }
    async getBranchShiftByCode(branchId, shiftCode) {
        return prisma_1.default.branch_shift_master.findUnique({
            where: {
                branch_id_shift_code: {
                    branch_id: branchId,
                    shift_code: shiftCode,
                },
            },
        });
    }
    async createBranchShift(data, shiftId) {
        const startTime = parseSqlTime(data.start_time);
        const endTime = parseSqlTime(data.end_time);
        return prisma_1.default.branch_shift_master.create({
            data: {
                shift_id: shiftId,
                branch_id: data.branch_id,
                shift_code: data.shift_code.toUpperCase(),
                shift_name: data.shift_name,
                start_time: startTime,
                end_time: endTime,
                is_overnight: data.is_overnight ?? false,
                display_order: data.display_order ?? 1,
                is_active: true,
            },
        });
    }
    async updateBranchShift(shiftId, data) {
        const updateData = {
            ...(data.shift_name !== undefined ? { shift_name: data.shift_name } : {}),
            ...(data.is_overnight !== undefined ? { is_overnight: data.is_overnight } : {}),
            ...(data.display_order !== undefined ? { display_order: data.display_order } : {}),
            ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
            updated_at: new Date(),
        };
        if (data.start_time) {
            updateData.start_time = parseSqlTime(data.start_time);
        }
        if (data.end_time) {
            updateData.end_time = parseSqlTime(data.end_time);
        }
        return prisma_1.default.branch_shift_master.update({
            where: { shift_id: shiftId },
            data: updateData,
        });
    }
    // -------------------------------------------------------------
    // 2. Weekly Templates
    // -------------------------------------------------------------
    async getTemplates(branchId) {
        return prisma_1.default.staff_duty_roster_template.findMany({
            where: { branch_id: branchId, is_active: true },
            include: {
                employees: {
                    select: {
                        employee_id: true,
                        first_name: true,
                        middle_name: true,
                        last_name: true,
                        specialization: true,
                        department_id: true,
                        user_table: { select: { role_type: true } },
                    },
                },
            },
            orderBy: [{ day_of_week: "asc" }, { shift_code: "asc" }],
        });
    }
    async getTemplatesForDayAndShift(branchId, dayOfWeek, shiftCode, roleInDuty) {
        return prisma_1.default.staff_duty_roster_template.findMany({
            where: {
                branch_id: branchId,
                day_of_week: dayOfWeek.toUpperCase(),
                is_active: true,
                ...(shiftCode ? { shift_code: shiftCode.toUpperCase() } : {}),
                ...(roleInDuty ? { role_in_duty: roleInDuty } : {}),
            },
            include: {
                employees: {
                    select: {
                        employee_id: true,
                        first_name: true,
                        middle_name: true,
                        last_name: true,
                        specialization: true,
                        department_id: true,
                        user_table: { select: { role_type: true } },
                    },
                },
            },
        });
    }
    async upsertTemplate(data, templateId, createdBy) {
        let startTime;
        let endTime;
        if (data.start_time && data.end_time) {
            startTime = parseSqlTime(data.start_time);
            endTime = parseSqlTime(data.end_time);
        }
        else {
            const shift = await this.getBranchShiftByCode(data.branch_id, data.shift_code);
            if (!shift) {
                throw new Error(`Shift configuration not found for '${data.shift_code}' in branch ${data.branch_id}`);
            }
            startTime = parseSqlTime(shift.start_time);
            endTime = parseSqlTime(shift.end_time);
        }
        return prisma_1.default.staff_duty_roster_template.upsert({
            where: {
                employee_id_branch_id_day_of_week_shift_code_role_in_duty: {
                    employee_id: data.employee_id,
                    branch_id: data.branch_id,
                    day_of_week: data.day_of_week.toUpperCase(),
                    shift_code: data.shift_code.toUpperCase(),
                    role_in_duty: data.role_in_duty,
                },
            },
            update: {
                start_time: startTime,
                end_time: endTime,
                is_active: true,
                effective_from: data.effective_from ? new Date(data.effective_from) : undefined,
                effective_to: data.effective_to ? new Date(data.effective_to) : undefined,
            },
            create: {
                template_id: templateId,
                employee_id: data.employee_id,
                branch_id: data.branch_id,
                day_of_week: data.day_of_week.toUpperCase(),
                shift_code: data.shift_code.toUpperCase(),
                start_time: startTime,
                end_time: endTime,
                role_in_duty: data.role_in_duty,
                effective_from: data.effective_from ? new Date(data.effective_from) : undefined,
                effective_to: data.effective_to ? new Date(data.effective_to) : undefined,
                created_by: createdBy,
                is_active: true,
            },
            include: {
                employees: {
                    select: {
                        employee_id: true,
                        first_name: true,
                        middle_name: true,
                        last_name: true,
                        specialization: true,
                    },
                },
            },
        });
    }
    async deleteTemplate(templateId) {
        return prisma_1.default.staff_duty_roster_template.delete({
            where: { template_id: templateId },
        });
    }
    // -------------------------------------------------------------
    // 3. Specific Date Roster Entries
    // -------------------------------------------------------------
    async getRosterEntriesRange(branchId, fromDate, toDate) {
        return prisma_1.default.staff_duty_roster.findMany({
            where: {
                branch_id: branchId,
                duty_date: { gte: fromDate, lte: toDate },
                is_active: true,
            },
            include: {
                employees: {
                    select: {
                        employee_id: true,
                        first_name: true,
                        middle_name: true,
                        last_name: true,
                        specialization: true,
                        department_id: true,
                        user_table: { select: { role_type: true } },
                    },
                },
            },
            orderBy: [{ duty_date: "asc" }, { shift_code: "asc" }],
        });
    }
    async getRosterEntriesForDate(branchId, dutyDate, shiftCode, roleInDuty) {
        return prisma_1.default.staff_duty_roster.findMany({
            where: {
                branch_id: branchId,
                duty_date: dutyDate,
                is_active: true,
                ...(shiftCode ? { shift_code: shiftCode.toUpperCase() } : {}),
                ...(roleInDuty ? { role_in_duty: roleInDuty } : {}),
            },
            include: {
                employees: {
                    select: {
                        employee_id: true,
                        first_name: true,
                        middle_name: true,
                        last_name: true,
                        specialization: true,
                        department_id: true,
                        user_table: { select: { role_type: true } },
                    },
                },
            },
        });
    }
    async upsertRosterEntry(data, rosterId, createdBy) {
        let startTime;
        let endTime;
        if (data.start_time && data.end_time) {
            startTime = parseSqlTime(data.start_time);
            endTime = parseSqlTime(data.end_time);
        }
        else {
            const shift = await this.getBranchShiftByCode(data.branch_id, data.shift_code);
            if (!shift) {
                throw new Error(`Shift configuration not found for '${data.shift_code}' in branch ${data.branch_id}`);
            }
            startTime = parseSqlTime(shift.start_time);
            endTime = parseSqlTime(shift.end_time);
        }
        const dutyDate = new Date(data.duty_date);
        return prisma_1.default.staff_duty_roster.upsert({
            where: {
                employee_id_branch_id_duty_date_shift_code_role_in_duty: {
                    employee_id: data.employee_id,
                    branch_id: data.branch_id,
                    duty_date: dutyDate,
                    shift_code: data.shift_code.toUpperCase(),
                    role_in_duty: data.role_in_duty,
                },
            },
            update: {
                start_time: startTime,
                end_time: endTime,
                notes: data.notes,
                is_active: true,
                updated_by: createdBy,
                updated_at: new Date(),
            },
            create: {
                roster_id: rosterId,
                employee_id: data.employee_id,
                branch_id: data.branch_id,
                duty_date: dutyDate,
                shift_code: data.shift_code.toUpperCase(),
                start_time: startTime,
                end_time: endTime,
                role_in_duty: data.role_in_duty,
                notes: data.notes,
                is_active: true,
                created_by: createdBy,
            },
            include: {
                employees: {
                    select: {
                        employee_id: true,
                        first_name: true,
                        middle_name: true,
                        last_name: true,
                        specialization: true,
                    },
                },
            },
        });
    }
    async deleteRosterEntry(rosterId) {
        return prisma_1.default.staff_duty_roster.delete({
            where: { roster_id: rosterId },
        });
    }
    // -------------------------------------------------------------
    // 4. Availability & Active Load Lookups
    // -------------------------------------------------------------
    async getActivePatientCounts(employeeIds) {
        if (!employeeIds.length)
            return {};
        const activeRows = await prisma_1.default.admission_care_team.groupBy({
            by: ["employee_id"],
            where: {
                employee_id: { in: employeeIds },
                is_active: true,
            },
            _count: {
                admission_id: true,
            },
        });
        const counts = {};
        for (const row of activeRows) {
            counts[row.employee_id] = row._count.admission_id;
        }
        return counts;
    }
    async getApprovedLeaves(employeeIds, targetDate) {
        if (!employeeIds.length)
            return new Set();
        const leaves = await prisma_1.default.doctor_leave.findMany({
            where: {
                employee_id: { in: employeeIds },
                status: "APPROVED",
                leave_start_date: { lte: targetDate },
                leave_end_date: { gte: targetDate },
            },
            select: { employee_id: true },
        });
        return new Set(leaves.map((l) => l.employee_id));
    }
    async getAllBranchStaffByRole(branchId, roleType) {
        return prisma_1.default.employees.findMany({
            where: {
                emp_status: true,
                deleted_at: null,
                user_table: { role_type: roleType },
                user_branch_mapping: {
                    some: { branch_id: branchId, status: 1 },
                },
            },
            select: {
                employee_id: true,
                first_name: true,
                middle_name: true,
                last_name: true,
                specialization: true,
                department_id: true,
                user_table: { select: { role_type: true } },
            },
            orderBy: [{ first_name: "asc" }, { last_name: "asc" }],
        });
    }
}
exports.DutyRosterRepository = DutyRosterRepository;
