"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoctorLeaveService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const doctorLeave_repository_1 = require("./doctorLeave.repository");
const doctorLeave_constants_1 = require("./doctorLeave.constants");
class DoctorLeaveService {
    repository = new doctorLeave_repository_1.DoctorLeaveRepository();
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
        return employee;
    }
    async applyLeave(employeeId, dto, requestedBy, requesterRole) {
        const doctor = await this.resolveDoctor(employeeId);
        const startDate = new Date(dto.leave_start_date);
        const endDate = new Date(dto.leave_end_date);
        if (isNaN(startDate.getTime())) {
            throw new Error("Invalid leave start date");
        }
        if (isNaN(endDate.getTime())) {
            throw new Error("Invalid leave end date");
        }
        if (startDate > endDate) {
            throw new Error("Leave start date cannot be after leave end date");
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (startDate < today) {
            throw new Error("Leave cannot start in the past");
        }
        if (!dto.leave_reason?.trim()) {
            throw new Error("Leave reason is required");
        }
        const pendingLeave = await this.repository.findPendingLeave(employeeId);
        if (pendingLeave) {
            throw new Error("Doctor already has a pending leave request");
        }
        if (dto.replacement_employee_id) {
            const replacement = await this.repository.findReplacementDoctor(dto.replacement_employee_id);
            if (!replacement) {
                throw new Error("Replacement doctor not found");
            }
            if (replacement.user_table?.role_type !== "DOCTOR") {
                throw new Error("Replacement employee is not a doctor");
            }
            if (replacement.emp_status === false) {
                throw new Error("Replacement doctor is inactive");
            }
            if (dto.replacement_employee_id === employeeId) {
                throw new Error("Replacement doctor cannot be the same doctor");
            }
        }
        /*
         * ADMIN AUTO-APPROVAL
         *
         * If an administrator creates the leave:
         *
         * status       = APPROVED
         * requested_by  = logged-in admin user_id
         * approved_by   = logged-in admin user_id
         * approved_at   = current time
         *
         * Otherwise:
         *
         * status       = PENDING
         * requested_by  = logged-in user's user_id
         * approved_by   = null
         */
        const isAdmin = requesterRole === "ADMIN" ||
            requesterRole === "HEAD_ADMIN" ||
            requesterRole === "SUPER_ADMIN" ||
            requesterRole === "BRANCH_ADMIN";
        const leaveStatus = isAdmin
            ? doctorLeave_constants_1.LEAVE_STATUS.APPROVED
            : doctorLeave_constants_1.LEAVE_STATUS.PENDING;
        const now = new Date();
        return prisma_1.default.$transaction(async (tx) => {
            const leaveId = await this.repository.generateLeaveId(tx);
            const leave = await this.repository.applyLeave(tx, {
                leave_id: leaveId,
                employee_id: employeeId,
                replacement_employee_id: dto.replacement_employee_id ?? null,
                leave_start_date: startDate,
                leave_end_date: endDate,
                leave_reason: dto.leave_reason,
                status: leaveStatus,
                requested_by: requestedBy,
                requested_at: now,
                /*
                 * Admin-created leave is immediately approved.
                 */
                ...(isAdmin
                    ? {
                        approved_by: requestedBy,
                        approved_at: now
                    }
                    : {}),
                branch_id: doctor.branch_id
            });
            return {
                message: isAdmin
                    ? "Leave applied and approved successfully"
                    : "Leave applied successfully",
                leave
            };
        });
    }
    async approveLeave(leaveId, dto, approvedBy) {
        const leave = await this.repository.findLeaveById(leaveId);
        if (!leave) {
            throw new Error("Leave request not found");
        }
        if (leave.status !== doctorLeave_constants_1.LEAVE_STATUS.PENDING) {
            throw new Error(`Leave request is already ${leave.status}`);
        }
        return prisma_1.default.$transaction(async (tx) => {
            const updatedLeave = await this.repository.approveLeave(tx, leaveId, {
                status: doctorLeave_constants_1.LEAVE_STATUS.APPROVED,
                approved_by: approvedBy,
                approved_at: new Date(),
                remarks: dto.remarks ?? null
            });
            return {
                message: "Leave approved successfully",
                leave: updatedLeave
            };
        });
    }
    async rejectLeave(leaveId, dto, rejectedBy) {
        const leave = await this.repository.findLeaveById(leaveId);
        if (!leave) {
            throw new Error("Leave request not found");
        }
        if (leave.status !== doctorLeave_constants_1.LEAVE_STATUS.PENDING) {
            throw new Error(`Leave request is already ${leave.status}`);
        }
        if (!dto.remarks?.trim()) {
            throw new Error("Remarks are required while rejecting a leave request");
        }
        return prisma_1.default.$transaction(async (tx) => {
            const updatedLeave = await this.repository.rejectLeave(tx, leaveId, {
                status: doctorLeave_constants_1.LEAVE_STATUS.REJECTED,
                rejected_by: rejectedBy,
                rejected_at: new Date(),
                remarks: dto.remarks
            });
            return {
                message: "Leave rejected successfully",
                leave: updatedLeave
            };
        });
    }
    async getDoctorLeaves(query) {
        return this.repository.getDoctorLeaves(query);
    }
}
exports.DoctorLeaveService = DoctorLeaveService;
