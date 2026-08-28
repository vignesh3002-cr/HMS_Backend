"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoctorLeaveService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const doctorLeave_repository_1 = require("./doctorLeave.repository");
const doctorLeave_constants_1 = require("./doctorLeave.constants");
const doctorTransfer_constants_1 = require("../doctor-transfer/doctorTransfer.constants");
const idGenerator_1 = require("../../utils/idGenerator");
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
        const startDateStr = dto.leave_start_date;
        const endDateStr = dto.leave_end_date;
        const overlappingLeave = await this.repository.findOverlappingLeaves(employeeId, startDateStr, endDateStr);
        if (overlappingLeave) {
            throw new Error(`Leave overlaps with an existing ${overlappingLeave.status} leave request (${overlappingLeave.leave_id})`);
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
                leave_type: dto.leave_type ?? null,
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
    /*
     * =========================================================
     * LEAVE CONFLICT LOOKUP
     *
     * Active (non-terminal) appointments for the doctor inside
     * the leave range — used by the UI before applying leave.
     * Deliberately branch-agnostic: leaves affect every
     * branch the doctor works at.
     * =========================================================
     */
    async getLeaveConflicts(employeeId, dto) {
        const startDate = new Date(`${dto.date_from}T00:00:00.000Z`);
        const endDate = new Date(`${dto.date_to}T00:00:00.000Z`);
        if (isNaN(startDate.getTime()) ||
            isNaN(endDate.getTime())) {
            throw new Error("Invalid leave date range");
        }
        if (endDate < startDate) {
            throw new Error("End date cannot be before start date");
        }
        const appointments = await this.repository.findActiveAppointmentsInRange(prisma_1.default, employeeId, dto.date_from, dto.date_to);
        return appointments.map((appointment) => ({
            appointment_id: appointment.appointment_id,
            patient_first_name: appointment.patient_bio_data
                ?.patient_first_name ?? null,
            patient_middle_name: appointment.patient_bio_data
                ?.patient_middle_name ?? null,
            patient_last_name: appointment.patient_bio_data
                ?.patient_last_name ?? null,
            appointment_date: appointment.appointment_date,
            appointment_time: appointment.appointment_time,
            status: appointment.status
        }));
    }
    /*
     * =========================================================
     * QUEUE APPOINTMENTS FOR RESCHEDULE (LEAVE CONFLICT)
     *
     * Marks every active appointment of the doctor inside the
     * leave date range as RESCHEDULE_REQUIRED and inserts a
     * PENDING entry into the reschedule queue so staff can
     * assign new slots from the Reschedule Queue page.
     * =========================================================
     */
    async queueRescheduleForLeave(employeeId, dto, createdBy) {
        const startDate = new Date(`${dto.date_from}T00:00:00.000Z`);
        const endDate = new Date(`${dto.date_to}T00:00:00.000Z`);
        if (isNaN(startDate.getTime()) ||
            isNaN(endDate.getTime())) {
            throw new Error("Invalid leave date range");
        }
        if (endDate < startDate) {
            throw new Error("End date cannot be before start date");
        }
        return prisma_1.default.$transaction(async (tx) => {
            const appointments = await this.repository.findActiveAppointmentsInRange(tx, employeeId, dto.date_from, dto.date_to);
            let queued = 0;
            for (const appointment of appointments) {
                await this.repository.markAppointmentRescheduleRequired(tx, appointment.appointment_id);
                const queueId = await (0, idGenerator_1.generateId)(tx, "RESCHEDULE_QUEUE");
                await this.repository.createRescheduleQueueEntry(tx, {
                    queue_id: queueId,
                    appointment_id: appointment.appointment_id,
                    patient_id: appointment.patient_id,
                    employee_id: employeeId,
                    branch_id: appointment.branch_id ?? "",
                    department_id: appointment.department_id,
                    old_schedule_id: appointment.schedule_id,
                    old_appointment_date: appointment.appointment_date,
                    old_appointment_time: appointment.appointment_time,
                    transfer_id: null,
                    priority: dto.priority ?? "NORMAL",
                    reason: `DOCTOR_LEAVE${dto.reason ? `: ${dto.reason}` : ""}`,
                    status: doctorTransfer_constants_1.RESCHEDULE_QUEUE_STATUS.PENDING,
                    created_by: createdBy
                });
                queued += 1;
            }
            return { total: appointments.length, queued };
        });
    }
}
exports.DoctorLeaveService = DoctorLeaveService;
