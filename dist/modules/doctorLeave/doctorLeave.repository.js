"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoctorLeaveRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const idGenerator_1 = require("../../utils/idGenerator");
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
}
exports.DoctorLeaveRepository = DoctorLeaveRepository;
