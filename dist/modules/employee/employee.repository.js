"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const idGenerator_1 = require("../../utils/idGenerator");
const appointment_constants_1 = require("../appointment/appointment.constants");
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
                deleted_at: new Date(),
                branch_id: null
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
    async getAllEmployees() {
        return prisma_1.default.employees.findMany();
    }
    async getEmployees(query) {
        const { roleType, branchId, department, status, includeDeleted, search, page = 1, limit = 10 } = query;
        const where = {};
        if (department) {
            where.department_id = department;
        }
        if (branchId) {
            where.branch_id = branchId;
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
                role_type: roleType
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
        return {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            employees
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
        const branches = await prisma_1.default.user_branch_mapping.findMany({
            where: {
                user_id: employee.user_id
            },
            include: {
                branch: true
            },
            orderBy: {
                assigned_date: "desc",
            },
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
            branches: branches.map(x => ({
                branch_id: x.branch.branch_id,
                branch_name: x.branch.branch_name,
                status: x.status,
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
}
exports.EmployeeRepository = EmployeeRepository;
