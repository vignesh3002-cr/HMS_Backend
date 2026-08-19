"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const idGenerator_1 = require("../../utils/idGenerator");
const appointment_constants_1 = require("../appointment/appointment.constants");
function parseDateOnlyUtc(dateString) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateString);
    if (!match) {
        const date = new Date(dateString);
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    }
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}
class EmployeeRepository {
    async findUsername(username) {
        return prisma_1.default.user_table.findFirst({
            where: {
                username
            }
        });
    }
    async findEmail(email) {
        return prisma_1.default.employees.findFirst({
            where: {
                email
            }
        });
    }
    async findMobile(mobile) {
        return prisma_1.default.employees.findFirst({
            where: {
                mobile_no: mobile
            }
        });
    }
    async findAadhaar(aadhaar) {
        return prisma_1.default.employees.findFirst({
            where: {
                aadhaar_no: aadhaar
            }
        });
    }
    async findPAN(pan) {
        return prisma_1.default.employees.findFirst({
            where: {
                pan_no: pan
            }
        });
    }
    async findLicense(license) {
        return prisma_1.default.employees.findFirst({
            where: {
                license_no: license
            }
        });
    }
    async findDepartment(id) {
        return prisma_1.default.department_master.findUnique({
            where: {
                department_id: id
            }
        });
    }
    async findScheduleById(scheduleId) {
        return prisma_1.default.doctor_schedule.findUnique({
            where: {
                schedule_id: scheduleId
            }
        });
    }
    async findBranch(branchId) {
        return prisma_1.default.branch.findUnique({
            where: {
                branch_id: branchId
            }
        });
    }
    async softDeleteEmployee(tx, employeeId) {
        return tx.employees.update({
            where: {
                employee_id: employeeId
            },
            data: {
                emp_status: false,
                deleted_at: new Date()
            }
        });
    }
    async closeSchedule(tx, scheduleId, actingUserId) {
        return tx.doctor_schedule.update({
            where: {
                schedule_id: scheduleId
            },
            data: {
                is_active: false,
                deleted_by: actingUserId,
                effective_to: new Date()
            }
        });
    }
    async closeSchedules(tx, employeeId, excludeScheduleIds, actingUserId) {
        return tx.doctor_schedule.updateMany({
            where: {
                employee_id: employeeId,
                schedule_id: { notIn: excludeScheduleIds }
            },
            data: {
                is_active: false,
                deleted_by: actingUserId,
                effective_to: new Date()
            }
        });
    }
    async blockUserLogin(tx, userId) {
        if (!userId) {
            return;
        }
        return tx.user_table.update({
            where: {
                user_id: userId
            },
            data: {
                user_status: 1
            }
        });
    }
    async deleteUserBranchMappings(tx, userId) {
        if (!userId) {
            return;
        }
        return tx.user_branch_mapping.deleteMany({
            where: {
                user_id: userId
            }
        });
    }
    async closeAllActiveSchedules(tx, employeeId, effectiveTo) {
        return tx.doctor_schedule.updateMany({
            where: {
                employee_id: employeeId,
                is_active: true
            },
            data: {
                is_active: false,
                effective_to: effectiveTo
            }
        });
    }
    async findFutureAppointmentsTx(tx, employeeId, fromDate) {
        return tx.appointment_history.findMany({
            where: {
                employee_id: employeeId,
                appointment_date: { gte: fromDate },
                status: { notIn: appointment_constants_1.TERMINAL_APPOINTMENT_STATUSES }
            },
            select: {
                appointment_id: true,
                patient_id: true,
                branch_id: true,
                department_id: true,
                schedule_id: true,
                appointment_date: true,
                appointment_time: true,
                status: true
            },
            orderBy: { appointment_date: "asc" }
        });
    }
    async requeueAppointment(tx, data) {
        await tx.appointment_history.update({
            where: {
                appointment_id: data.appointment_id
            },
            data: {
                status: "RESCHEDULE_REQUIRED",
                employee_id: null,
                schedule_id: null
            }
        });
        const queueId = await (0, idGenerator_1.generateId)(tx, "RESCHEDULE_QUEUE");
        await tx.appointment_reschedule_queue.create({
            data: {
                queue_id: queueId,
                appointment_id: data.appointment_id,
                patient_id: data.patient_id,
                employee_id: data.old_employee_id,
                branch_id: data.branch_id,
                department_id: data.department_id,
                old_schedule_id: data.old_schedule_id,
                old_appointment_date: data.old_appointment_date,
                old_appointment_time: data.old_appointment_time,
                priority: "NORMAL",
                reason: data.reason,
                status: "PENDING",
                created_by: data.created_by
            }
        });
        await tx.appointment_reschedule_action_log.create({
            data: {
                queue_id: queueId,
                action: "CREATED",
                performed_by: data.created_by,
                notes: `Created from employee deactivation (${data.reason})`
            }
        });
        return queueId;
    }
    async findOpenRescheduleQueueEntries(tx, appointmentId) {
        return tx.appointment_reschedule_queue.findMany({
            where: {
                appointment_id: appointmentId,
                status: { in: ["PENDING", "ASSIGNED"] }
            },
            orderBy: { created_at: "desc" }
        });
    }
    async closeRescheduleQueueEntry(tx, queueId, performedBy) {
        await tx.appointment_reschedule_queue.update({
            where: {
                queue_id: queueId
            },
            data: {
                status: "CONFIRMED",
                updated_at: new Date()
            }
        });
        await tx.appointment_reschedule_action_log.create({
            data: {
                queue_id: queueId,
                action: "CONFIRMED",
                performed_by: performedBy,
                notes: "Appointment updated directly via the edit appointment form"
            }
        });
    }
    async findEmployeeById(employeeId) {
        return prisma_1.default.employees.findUnique({
            where: {
                employee_id: employeeId
            },
            include: {
                user_table: {
                    select: {
                        role_type: true,
                        user_id: true
                    }
                }
            }
        });
    }
    async updateEmployee(employeeId, data) {
        return prisma_1.default.employees.update({
            where: {
                employee_id: employeeId
            },
            data
        });
    }
    async updateEmployeePhoto(employeeId, employee_photo_URL) {
        return prisma_1.default.employees.update({
            where: {
                employee_id: employeeId
            },
            data: {
                employee_photo_URL
            }
        });
    }
    async getAllEmployees() {
        return prisma_1.default.employees.findMany();
    }
    async getEmployees(query) {
        const { roleType, branchId, department, status, includeDeleted, search, page = 1, limit = 10, excludeEmployeeId, date } = query;
        const where = {};
        if (excludeEmployeeId) {
            where.employee_id = { not: excludeEmployeeId };
        }
        if (department) {
            where.department_id = department;
        }
        if (branchId) {
            // An employee counts as being on a branch either through the
            // denormalized employees.branch_id column (kept in sync for
            // single-branch roles) or through a real active user_branch_mapping
            // row. The mapping is the source of truth for multi-branch roles
            // like DOCTOR, whose column is intentionally left stale, so match
            // either. AND keeps this combined with the search OR below.
            where.AND = {
                OR: [
                    { branch_id: branchId },
                    { user_branch_mapping: { some: { branch_id: branchId, status: 1 } } },
                ],
            };
        }
        if (status !== undefined) {
            where.emp_status = status;
        }
        if (!includeDeleted) {
            where.deleted_at = null;
        }
        if (search) {
            where.OR = [
                {
                    first_name: {
                        contains: search,
                        mode: "insensitive"
                    }
                },
                {
                    last_name: {
                        contains: search,
                        mode: "insensitive"
                    }
                },
                {
                    email: {
                        contains: search,
                        mode: "insensitive"
                    }
                },
                {
                    mobile_no: {
                        contains: search,
                        mode: "insensitive"
                    }
                },
                {
                    employee_id: {
                        contains: search,
                        mode: "insensitive"
                    }
                }
            ];
        }
        if (roleType) {
            where.user_table = {
                role_type: {
                    equals: roleType,
                    mode: "insensitive"
                }
            };
        }
        const employees = await prisma_1.default.employees.findMany({
            where,
            include: {
                user_table: {
                    select: {
                        role_type: true,
                        user_status: true
                    }
                },
                branch: {
                    select: {
                        branch_name: true,
                        branch_area: true
                    }
                },
                // Active branch assignments (status 1) — the source of truth for
                // multi-branch roles like DOCTOR whose employees.branch_id column
                // is intentionally left stale. `branches` below is built from
                // these, never from the schedule table.
                user_branch_mapping: {
                    where: { status: 1 },
                    include: {
                        branch: {
                            select: {
                                branch_id: true,
                                branch_name: true,
                                branch_area: true,
                            },
                        },
                    },
                },
                department_master: {
                    select: {
                        department_name: true
                    }
                }
            },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: {
                id: "desc"
            }
        });
        const total = await prisma_1.default.employees.count({
            where
        });
        // Which branches actually have an active schedule row — used only to flag
        // has_schedule on each assigned branch. The assignment list itself comes
        // from user_branch_mapping above; a branch without any schedule is still
        // a real assignment and must still show up.
        const pageEmployeeIds = employees
            .map((e) => e.employee_id)
            .filter((id) => !!id);
        const scheduleGroups = await prisma_1.default.doctor_schedule.groupBy({
            by: ["employee_id", "branch_id"],
            where: {
                is_active: true,
                employee_id: { in: pageEmployeeIds },
            },
            _count: { _all: true },
        });
        const scheduleBranchesByEmployee = new Map();
        for (const group of scheduleGroups) {
            if (!group.employee_id)
                continue;
            const set = scheduleBranchesByEmployee.get(group.employee_id) ?? new Set();
            set.add(group.branch_id);
            scheduleBranchesByEmployee.set(group.employee_id, set);
        }
        const pageUserIds = employees
            .map((e) => e.user_id)
            .filter((id) => !!id);
        const activeMappings = await prisma_1.default.user_branch_mapping.findMany({
            where: {
                status: 1,
                OR: [
                    { employee_id: { in: pageEmployeeIds } },
                    { user_id: { in: pageUserIds } },
                ],
            },
            include: {
                branch: {
                    select: {
                        branch_id: true,
                        branch_name: true,
                        branch_area: true,
                    },
                },
            },
            orderBy: {
                assigned_date: "desc",
            },
        });
        const activeMappingsByEmployee = new Map();
        for (const mapping of activeMappings) {
            const employeeIds = new Set(employees
                .filter((emp) => emp.employee_id === mapping.employee_id || emp.user_id === mapping.user_id)
                .map((emp) => emp.employee_id)
                .filter((id) => !!id));
            for (const employeeId of employeeIds) {
                const list = activeMappingsByEmployee.get(employeeId) ?? [];
                list.push(mapping);
                activeMappingsByEmployee.set(employeeId, list);
            }
        }
        const employeesWithBranches = employees.map((emp) => {
            const hasScheduleFor = scheduleBranchesByEmployee.get(emp.employee_id ?? "") ?? new Set();
            // Collapse duplicate active mappings for the same branch to the first
            // row so the same branch never renders twice for one employee.
            const seenBranchIds = new Set();
            const assignedMappings = activeMappingsByEmployee.get(emp.employee_id ?? "") ?? emp.user_branch_mapping ?? [];
            const assignedBranches = assignedMappings
                .filter((m) => {
                const id = m.branch.branch_id;
                if (seenBranchIds.has(id))
                    return false;
                seenBranchIds.add(id);
                return true;
            })
                .map((m) => ({
                branch_id: m.branch.branch_id,
                branch_name: m.branch.branch_name,
                branch_area: m.branch.branch_area,
                has_schedule: hasScheduleFor.has(m.branch.branch_id),
            }));
            const { user_branch_mapping, ...rest } = emp;
            return { ...rest, branches: assignedBranches };
        });
        // Compute doctor_status for doctors if date is provided
        if (date) {
            const doctorIds = employeesWithBranches
                .filter((e) => e.user_table?.role_type?.toUpperCase() === "DOCTOR")
                .map((e) => e.employee_id)
                .filter(Boolean);
            if (doctorIds.length > 0) {
                const branchesByDoctor = new Map();
                employeesWithBranches.forEach((emp) => {
                    if (emp.user_table?.role_type?.toUpperCase() === "DOCTOR") {
                        branchesByDoctor.set(emp.employee_id, (emp.branches ?? []).map((branch) => branch.branch_id));
                    }
                });
                const statusMap = await this.computeDoctorStatuses(doctorIds, branchId, date, branchesByDoctor);
                employeesWithBranches.forEach((emp) => {
                    if (emp.user_table?.role_type?.toUpperCase() === "DOCTOR") {
                        emp.doctor_status = statusMap.get(emp.employee_id) || "LEAVE";
                    }
                });
            }
        }
        return {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            employees: employeesWithBranches
        };
    }
    async getEmployeeById(employeeId) {
        const employee = await prisma_1.default.employees.findUnique({
            where: {
                employee_id: employeeId
            },
            include: {
                // Never include the raw user_table row here — it carries the
                // hashed password. Select only the safe fields the UI needs.
                user_table: {
                    select: {
                        user_id: true,
                        role_type: true,
                        username: true,
                        user_status: true,
                        branch_id: true,
                        created_at: true,
                    },
                },
                branch: true,
                department_master: {
                    select: {
                        department_name: true
                    }
                }
            }
        });
        if (!employee) {
            throw new Error("Employee not found");
        }
        // Only ACTIVE mappings (status 1) are real, current assignments —
        // deactivated/historical rows (status 0) must never surface as the
        // doctor's branches. Duplicate active rows for the same branch (left
        // behind by transfer cycles) are collapsed to the newest one so the
        // UI can never render the same branch twice.
        const branches = await prisma_1.default.user_branch_mapping.findMany({
            where: {
                user_id: employee.user_id,
                status: 1,
            },
            include: {
                branch: true
            },
            orderBy: {
                assigned_date: "desc",
            },
        });
        // Which branches currently have an active schedule row — only used to
        // flag has_schedule on each mapped branch; the mapping list itself is
        // the assignment source of truth.
        const detailScheduleGroups = await prisma_1.default.doctor_schedule.groupBy({
            by: ["branch_id"],
            where: {
                is_active: true,
                employee_id: employeeId,
            },
            _count: { _all: true },
        });
        const detailScheduleBranches = new Set(detailScheduleGroups.map((g) => g.branch_id));
        // Collapse duplicate active mappings for the same branch to the newest
        // row (list is already ordered assigned_date desc) — a doctor must never
        // appear mapped to the same branch twice.
        const seenBranchIds = new Set();
        const uniqueBranches = branches.filter((x) => {
            const id = x.branch.branch_id;
            if (seenBranchIds.has(id))
                return false;
            seenBranchIds.add(id);
            return true;
        });
        const response = {
            employee,
            user: employee.user_table,
            // status is included so callers can tell an active assignment (1) apart
            // from a deactivated/historical one (0) — e.g. resolving "which branch
            // is this admin currently on" without a second, privileged API call.
            // assigned_date (with the list already ordered newest-first) lets a
            // caller find the MOST RECENT inactive mapping when there's more than
            // one in a Branch Admin's history, e.g. to suggest their last branch
            // when reactivating them.
            branches: uniqueBranches.map(x => ({
                branch_id: x.branch.branch_id,
                branch_name: x.branch.branch_name,
                status: x.status,
                has_schedule: detailScheduleBranches.has(x.branch.branch_id),
                assigned_date: x.assigned_date,
            }))
        };
        switch (employee.user_table?.role_type) {
            case "DOCTOR":
                const doctorProfile = await prisma_1.default.doctor_profile.findUnique({
                    where: {
                        employee_id: employeeId
                    }
                });
                const doctorSchedules = await prisma_1.default.doctor_schedule.findMany({
                    where: {
                        employee_id: employeeId,
                        is_active: true
                    },
                    include: {
                        branch: {
                            select: {
                                branch_name: true
                            }
                        }
                    }
                });
                response.doctorProfile =
                    doctorProfile;
                response.doctorSchedules =
                    doctorSchedules;
                break;
        }
        return response;
    }
    async computeDoctorStatuses(doctorIds, branchId, dateString, branchesByDoctor) {
        const dateStart = parseDateOnlyUtc(dateString);
        const dayOfWeek = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"][dateStart.getUTCDay()];
        // 1. emp_status check (INACTIVE override)
        const employees = await prisma_1.default.employees.findMany({
            where: { employee_id: { in: doctorIds } },
            select: { employee_id: true, emp_status: true }
        });
        const empStatusMap = new Map(employees.map(e => [e.employee_id, e.emp_status]));
        // 2. Active schedules for dayOfWeek + branch
        const schedules = await prisma_1.default.doctor_schedule.findMany({
            where: {
                employee_id: { in: doctorIds },
                is_active: true,
                ...(branchId ? { branch_id: branchId } : {}),
                day_of_week: { equals: dayOfWeek, mode: "insensitive" }
            },
            select: { employee_id: true, branch_id: true }
        });
        const scheduleSet = new Set(schedules.map(s => `${s.employee_id}|${s.branch_id}`));
        // 3. Compute one status per doctor. With a branch filter the status is
        // for that exact branch. Without one, aggregate across the doctor's
        // assigned branches: any branch with an active schedule for this day of
        // week makes the doctor ACTIVE; otherwise the doctor is on LEAVE.
        const statusMap = new Map();
        for (const doctorId of doctorIds) {
            const isInactive = empStatusMap.get(doctorId) === false;
            if (isInactive) {
                statusMap.set(doctorId, "INACTIVE");
                continue;
            }
            const assignedBranches = branchesByDoctor.get(doctorId) ?? [];
            const branches = branchId
                ? assignedBranches.includes(branchId) ? [branchId] : []
                : assignedBranches;
            const hasAvailableSchedule = branches.some((br) => {
                const key = `${doctorId}|${br}`;
                return scheduleSet.has(key);
            });
            statusMap.set(doctorId, hasAvailableSchedule ? "ACTIVE" : "LEAVE");
        }
        return statusMap;
    }
}
exports.EmployeeRepository = EmployeeRepository;
