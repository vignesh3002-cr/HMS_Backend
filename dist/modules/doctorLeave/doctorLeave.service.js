"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoctorLeaveService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const appointment_constants_1 = require("../appointment/appointment.constants");
const doctorLeave_repository_1 = require("./doctorLeave.repository");
const doctorLeave_constants_1 = require("./doctorLeave.constants");
const doctorTransfer_constants_1 = require("../doctor-transfer/doctorTransfer.constants");
const idGenerator_1 = require("../../utils/idGenerator");
class DoctorLeaveService {
    repository = new doctorLeave_repository_1.DoctorLeaveRepository();
    async resolveDoctor(employeeId) {
        const employee = await this.repository.findDoctorWithRole(employeeId);
        if (!employee) {
            throw new Error("Doctor or nurse not found");
        }
        // Duty nurses take leave through the same table, so the roster and the
        // care-team allocation exclude them while they are away.
        const roleType = employee.user_table?.role_type;
        if (roleType !== "DOCTOR" && roleType !== "NURSE") {
            throw new Error("Leave can only be applied for a doctor or a nurse");
        }
        if (employee.emp_status === false) {
            throw new Error("Employee is inactive");
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
            if (replacement.user_table?.role_type !== doctor.user_table?.role_type) {
                throw new Error(`Replacement employee must also be a ${String(doctor.user_table?.role_type ?? "doctor").toLowerCase()}`);
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
            // Admin-created leave is approved at once, so the doctor's booked
            // appointments in that window are queued in the same transaction
            // (no window where the leave exists but patients are still booked).
            if (isAdmin) {
                await this.queueForApprovedLeaveTx(tx, employeeId, startDate, endDate, requestedBy);
            }
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
            await this.queueForApprovedLeaveTx(tx, leave.employee_id, leave.leave_start_date, leave.leave_end_date, approvedBy);
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
            // Undo the reschedule queue the doctor's request created, so
            // patients are not left in RESCHEDULE_REQUIRED for a leave that
            // will never happen.
            await this.releaseLeaveQueueTx(tx, leave.employee_id, leave.leave_start_date, leave.leave_end_date);
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
        return prisma_1.default.$transaction((tx) => this.queueAppointmentsTx(tx, employeeId, dto.date_from, dto.date_to, createdBy, dto.priority ?? "NORMAL", dto.reason));
    }
    /*
     * Marks the doctor's active appointments in [dateFrom, dateTo] as
     * RESCHEDULE_REQUIRED and queues them, inside the caller's transaction.
     * Appointments already queued are skipped (findActiveAppointmentsInRange
     * excludes RESCHEDULE_REQUIRED), so calling it twice never double-queues.
     */
    async queueAppointmentsTx(tx, employeeId, dateFrom, dateTo, createdBy, priority = "NORMAL", reason, branchId, reasonPrefix = "DOCTOR_LEAVE") {
        const appointments = await this.repository.findActiveAppointmentsInRange(tx, employeeId, dateFrom, dateTo, branchId);
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
                priority,
                reason: `${reasonPrefix}${reason ? `: ${reason}` : ""}`,
                status: doctorTransfer_constants_1.RESCHEDULE_QUEUE_STATUS.PENDING,
                created_by: createdBy
            });
            queued += 1;
        }
        return { total: appointments.length, queued };
    }
    /*
     * A rejected leave must not leave patients stranded: undo the reschedule
     * queue created for it. Only entries still PENDING are released (a slot
     * already assigned/confirmed was handled by staff and is left alone), and
     * only appointments still marked RESCHEDULE_REQUIRED go back to SCHEDULED.
     * Leave requests of one doctor cannot overlap, so the date range belongs
     * to this leave alone.
     */
    async releaseLeaveQueueTx(tx, employeeId, dateFrom, dateTo) {
        const entries = await tx.appointment_reschedule_queue.findMany({
            where: {
                employee_id: employeeId,
                status: doctorTransfer_constants_1.RESCHEDULE_QUEUE_STATUS.PENDING,
                reason: { startsWith: "DOCTOR_LEAVE" },
                old_appointment_date: { gte: dateFrom, lte: dateTo }
            },
            select: { queue_id: true, appointment_id: true }
        });
        if (entries.length === 0)
            return 0;
        await tx.appointment_reschedule_queue.updateMany({
            where: { queue_id: { in: entries.map((e) => e.queue_id) } },
            data: { status: doctorTransfer_constants_1.RESCHEDULE_QUEUE_STATUS.CANCELLED }
        });
        await tx.appointment_history.updateMany({
            where: {
                appointment_id: { in: entries.map((e) => e.appointment_id) },
                status: appointment_constants_1.APPOINTMENT_STATUS.RESCHEDULE_REQUIRED
            },
            data: { status: appointment_constants_1.APPOINTMENT_STATUS.SCHEDULED }
        });
        return entries.length;
    }
    /** Queues the doctor's appointments for an approved leave (nurses have none). */
    async queueForApprovedLeaveTx(tx, employeeId, dateFrom, dateTo, actorUserId) {
        const emp = await this.repository.findDoctorWithRole(employeeId);
        if (emp?.user_table?.role_type !== "DOCTOR")
            return null;
        return this.queueAppointmentsTx(tx, employeeId, dateFrom.toISOString().slice(0, 10), dateTo.toISOString().slice(0, 10), actorUserId, "NORMAL", "Approved leave");
    }
}
exports.DoctorLeaveService = DoctorLeaveService;
