"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoctorLeaveRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const idGenerator_1 = require("../../utils/idGenerator");
const appointment_constants_1 = require("../appointment/appointment.constants");
class DoctorLeaveRepository {
    async generateLeaveId(tx) {
        return (0, idGenerator_1.generateId)(tx, "DOCTOR_LEAVE");
    }
    async findDoctorWithRole(employeeId) {
        return prisma_1.default.employees.findUnique({
            where: { employee_id: employeeId },
            include: {
                user_table: true,
                doctor_profile: true
            }
        });
    }
    async findReplacementDoctor(employeeId) {
        return prisma_1.default.employees.findUnique({
            where: { employee_id: employeeId },
            include: {
                user_table: true,
                doctor_profile: true
            }
        });
    }
    async findLeaveById(leaveId) {
        return prisma_1.default.doctor_leave.findUnique({
            where: {
                leave_id: leaveId
            }
        });
    }
    async findPendingLeave(employeeId) {
        return prisma_1.default.doctor_leave.findFirst({
            where: {
                employee_id: employeeId,
                status: "PENDING"
            }
        });
    }
    async findOverlappingLeaves(employeeId, startDate, endDate, excludeLeaveId) {
        return prisma_1.default.doctor_leave.findFirst({
            where: {
                employee_id: employeeId,
                status: {
                    in: ["PENDING", "APPROVED"]
                },
                ...(excludeLeaveId ? { leave_id: { not: excludeLeaveId } } : {}),
                AND: [
                    {
                        leave_start_date: {
                            lte: new Date(`${endDate}T23:59:59.999Z`)
                        }
                    },
                    {
                        leave_end_date: {
                            gte: new Date(`${startDate}T00:00:00.000Z`)
                        }
                    }
                ]
            }
        });
    }
    async applyLeave(tx, data) {
        return tx.doctor_leave.create({
            data
        });
    }
    async approveLeave(tx, leaveId, data) {
        return tx.doctor_leave.update({
            where: {
                leave_id: leaveId
            },
            data
        });
    }
    async rejectLeave(tx, leaveId, data) {
        return tx.doctor_leave.update({
            where: {
                leave_id: leaveId
            },
            data
        });
    }
    async getDoctorLeaves(query) {
        const { employee_id, status, page = 1, limit = 10 } = query;
        const where = {};
        if (employee_id) {
            where.employee_id = employee_id;
        }
        if (status) {
            where.status = status;
        }
        const [leaves, total] = await Promise.all([
            prisma_1.default.doctor_leave.findMany({
                where,
                orderBy: {
                    requested_at: "desc"
                },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma_1.default.doctor_leave.count({
                where
            })
        ]);
        return {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            leaves
        };
    }
    async findActiveAppointmentsInRange(tx, employeeId, dateFrom, dateTo) {
        return tx.appointment_history.findMany({
            where: {
                employee_id: employeeId,
                appointment_date: {
                    gte: new Date(`${dateFrom}T00:00:00.000Z`),
                    lte: new Date(`${dateTo}T23:59:59.999Z`)
                },
                status: {
                    notIn: [
                        ...appointment_constants_1.TERMINAL_APPOINTMENT_STATUSES,
                        appointment_constants_1.APPOINTMENT_STATUS.RESCHEDULE_REQUIRED
                    ]
                }
            },
            select: {
                appointment_id: true,
                patient_id: true,
                branch_id: true,
                department_id: true,
                schedule_id: true,
                appointment_date: true,
                appointment_time: true,
                status: true,
                patient_bio_data: {
                    select: {
                        patient_first_name: true,
                        patient_middle_name: true,
                        patient_last_name: true
                    }
                }
            },
            orderBy: [
                { appointment_date: "asc" },
                { appointment_time: "asc" }
            ]
        });
    }
    async markAppointmentRescheduleRequired(tx, appointmentId) {
        return tx.appointment_history.update({
            where: { appointment_id: appointmentId },
            data: { status: appointment_constants_1.APPOINTMENT_STATUS.RESCHEDULE_REQUIRED }
        });
    }
    async createRescheduleQueueEntry(tx, data) {
        return tx.appointment_reschedule_queue.create({ data });
    }
}
exports.DoctorLeaveRepository = DoctorLeaveRepository;
