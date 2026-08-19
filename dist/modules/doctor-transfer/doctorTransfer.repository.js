"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoctorTransferRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const idGenerator_1 = require("../../utils/idGenerator");
const appointment_constants_1 = require("../appointment/appointment.constants");
const rescheduleQueueDetailInclude = {
    appointment_history: {
        select: {
            appointment_id: true,
            appointment_date: true,
            appointment_time: true,
            status: true
        }
    },
    patient_bio_data: {
        select: {
            patient_id: true,
            patient_first_name: true,
            patient_last_name: true,
            patient_primary_mobile: true
        }
    },
    branch: {
        select: {
            branch_id: true,
            branch_name: true
        }
    }
};
class DoctorTransferRepository {
    async findDoctorWithRole(employeeId) {
        return prisma_1.default.employees.findUnique({
            where: { employee_id: employeeId },
            include: {
                user_table: { select: { user_id: true, role_type: true, user_status: true } },
                doctor_profile: true
            }
        });
    }
    // Match on employee_id OR user_id: mappings created before the
    // employee_id column was populated may only carry user_id.
    mappingWhere(employeeId, userId) {
        return userId
            ? { OR: [{ employee_id: employeeId }, { user_id: userId }] }
            : { employee_id: employeeId };
    }
    async findAnyActiveBranchMapping(employeeId, userId) {
        return prisma_1.default.user_branch_mapping.findFirst({
            where: {
                ...this.mappingWhere(employeeId, userId),
                status: 1
            },
            orderBy: { assigned_date: "desc" }
        });
    }
    async findPendingTransfer(employeeId) {
        return prisma_1.default.doctor_transfer.findFirst({
            where: {
                employee_id: employeeId,
                status: "PENDING_CONFIRMATION"
            },
            orderBy: { requested_at: "desc" }
        });
    }
    async findActiveBranchMapping(employeeId, branchId, userId) {
        return prisma_1.default.user_branch_mapping.findFirst({
            where: {
                ...this.mappingWhere(employeeId, userId),
                branch_id: branchId,
                status: 1
            }
        });
    }
    async findActiveBranch(branchId) {
        return prisma_1.default.branch.findFirst({
            where: { branch_id: branchId, branch_status: "Active" }
        });
    }
    async findDepartment(departmentId) {
        return prisma_1.default.department_master.findUnique({
            where: { department_id: departmentId }
        });
    }
    async findPatient(patientId) {
        return prisma_1.default.patient_bio_data.findUnique({
            where: { patient_id: patientId }
        });
    }
    async findAllActiveSchedules(employeeId) {
        return prisma_1.default.doctor_schedule.findMany({
            where: { employee_id: employeeId, is_active: true }
        });
    }
    async findAllActiveSchedulesInTx(tx, employeeId) {
        return tx.doctor_schedule.findMany({
            where: { employee_id: employeeId, is_active: true }
        });
    }
    // Doctors, other than the one being transferred, currently working this
    // exact branch/day/department - candidates the service filters further
    // by time overlap with the specific appointment slot. Only doctors with
    // an ACTIVE user_branch_mapping (status 1) at this branch qualify —
    // schedules alone are not an assignment (rule: mapping is the source
    // of truth for branch visibility).
    async findEligibleReplacementCandidates(branchId, departmentId, excludeEmployeeId, dayOfWeek) {
        return prisma_1.default.doctor_schedule.findMany({
            where: {
                branch_id: branchId,
                day_of_week: dayOfWeek,
                is_active: true,
                employee_id: { not: excludeEmployeeId },
                employees: {
                    department_id: departmentId,
                    emp_status: { not: false },
                    user_table: { role_type: "DOCTOR" },
                    user_branch_mapping: {
                        some: { branch_id: branchId, status: 1 }
                    }
                }
            },
            include: {
                employees: {
                    select: { employee_id: true, first_name: true, last_name: true }
                }
            }
        });
    }
    async findFutureAppointments(employeeId, effectiveDate, page = 1, limit = 50) {
        const where = {
            employee_id: employeeId,
            appointment_date: { gte: effectiveDate },
            status: { notIn: appointment_constants_1.TERMINAL_APPOINTMENT_STATUSES }
        };
        const [appointments, total] = await Promise.all([
            prisma_1.default.appointment_history.findMany({
                where,
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
                            patient_last_name: true,
                            patient_primary_mobile: true
                        }
                    }
                },
                orderBy: { appointment_date: "asc" },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma_1.default.appointment_history.count({ where })
        ]);
        return { appointments, total };
    }
    // Scoped to the specific schedule rows being closed (not "any future
    // appointment this employee has anywhere") - a branch/time-slot conflict
    // must never flag appointments at a branch that isn't actually affected.
    //
    // Fallback coverage for appointments that can't be matched by
    // schedule_id alone (booked without a schedule link, or pointing at a
    // row closed by an earlier transfer): when branchIds are provided,
    // appointments at those branches are matched too. A true TRANSFER
    // (includeAllAtBranches) counts EVERY non-terminal future appointment at
    // the closing branches, because the whole branch is closing; a slot-level
    // move only matches schedule-less (schedule_id NULL) appointments, so
    // other slots at the same branch stay out of scope.
    async findFutureAppointmentsByScheduleIds(scheduleIds, effectiveDate, options, page = 1, limit = 200) {
        const fallbackConds = [];
        if (options?.branchIds?.length) {
            if (options.includeAllAtBranches) {
                fallbackConds.push({
                    employee_id: options.employeeId,
                    branch_id: { in: options.branchIds }
                });
            }
            else {
                fallbackConds.push({
                    schedule_id: null,
                    branch_id: { in: options.branchIds }
                });
            }
        }
        const where = {
            appointment_date: { gte: effectiveDate },
            status: { notIn: appointment_constants_1.TERMINAL_APPOINTMENT_STATUSES },
            OR: [
                { schedule_id: { in: scheduleIds } },
                ...fallbackConds
            ]
        };
        const [appointments, total] = await Promise.all([
            prisma_1.default.appointment_history.findMany({
                where,
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
                            patient_last_name: true,
                            patient_primary_mobile: true
                        }
                    }
                },
                orderBy: { appointment_date: "asc" },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma_1.default.appointment_history.count({ where })
        ]);
        return { appointments, total };
    }
    async findAllFutureAppointmentsForTransferByScheduleIds(tx, scheduleIds, effectiveDate, options) {
        const fallbackConds = [];
        if (options?.branchIds?.length) {
            if (options.includeAllAtBranches) {
                fallbackConds.push({
                    employee_id: options.employeeId,
                    branch_id: { in: options.branchIds }
                });
            }
            else {
                fallbackConds.push({
                    schedule_id: null,
                    branch_id: { in: options.branchIds }
                });
            }
        }
        return tx.appointment_history.findMany({
            where: {
                appointment_date: { gte: effectiveDate },
                status: { notIn: appointment_constants_1.TERMINAL_APPOINTMENT_STATUSES },
                OR: [
                    { schedule_id: { in: scheduleIds } },
                    ...fallbackConds
                ]
            },
            orderBy: { appointment_date: "asc" }
        });
    }
    async lockAppointment(tx, appointmentId) {
        await tx.$queryRaw `SELECT id FROM appointment_history WHERE appointment_id = ${appointmentId} FOR UPDATE`;
    }
    async lockDoctorTransfer(tx, transferId) {
        await tx.$queryRaw `SELECT id FROM doctor_transfer WHERE transfer_id = ${transferId} FOR UPDATE`;
    }
    async generateTransferId(tx) {
        return (0, idGenerator_1.generateId)(tx, "DOCTOR_TRANSFER");
    }
    async generateQueueId(tx) {
        return (0, idGenerator_1.generateId)(tx, "RESCHEDULE_QUEUE");
    }
    async generateNotificationId(tx) {
        return (0, idGenerator_1.generateId)(tx, "NOTIFICATION");
    }
    async createDoctorTransfer(tx, data) {
        return tx.doctor_transfer.create({ data });
    }
    async updateDoctorTransfer(tx, transferId, data) {
        return tx.doctor_transfer.update({
            where: { transfer_id: transferId },
            data
        });
    }
    async getDoctorTransferById(transferId) {
        return prisma_1.default.doctor_transfer.findUnique({
            where: { transfer_id: transferId }
        });
    }
    async closeBranchMapping(tx, employeeId, branchId, effectiveTo, userId) {
        await tx.user_branch_mapping.updateMany({
            where: {
                ...this.mappingWhere(employeeId, userId),
                branch_id: branchId,
                status: 1
            },
            data: { status: 0, effective_to: effectiveTo }
        });
    }
    async createBranchMapping(tx, data) {
        return tx.user_branch_mapping.create({ data });
    }
    async findSchedulesByIds(tx, scheduleIds) {
        return tx.doctor_schedule.findMany({
            where: { schedule_id: { in: scheduleIds } },
            select: { schedule_id: true, branch_id: true }
        });
    }
    async closeSchedulesByIds(tx, scheduleIds, effectiveTo, deletedBy) {
        await tx.doctor_schedule.updateMany({
            where: { schedule_id: { in: scheduleIds } },
            data: { is_active: false, effective_to: effectiveTo, ...(deletedBy ? { deleted_by: deletedBy } : {}) }
        });
    }
    // Closes EVERY active schedule a doctor still has at one branch — used
    // when a doctor is actually transferred away from a branch, so no active
    // slot keeps them visible/available there (mapping alone is closed too).
    async closeSchedulesAtBranch(tx, employeeId, branchId, effectiveTo, deletedBy) {
        await tx.doctor_schedule.updateMany({
            where: { employee_id: employeeId, branch_id: branchId, is_active: true },
            data: { is_active: false, effective_to: effectiveTo, ...(deletedBy ? { deleted_by: deletedBy } : {}) }
        });
    }
    async countActiveSchedulesAtBranch(tx, employeeId, branchId) {
        return tx.doctor_schedule.count({
            where: { employee_id: employeeId, branch_id: branchId, is_active: true }
        });
    }
    async createDoctorSchedule(tx, data) {
        return tx.doctor_schedule.create({ data });
    }
    async updateEmployeeBranchDept(tx, employeeId, data) {
        return tx.employees.update({
            where: { employee_id: employeeId },
            data
        });
    }
    async updateAppointment(tx, appointmentId, data) {
        return tx.appointment_history.update({
            where: { appointment_id: appointmentId },
            data
        });
    }
    async createTransferAppointmentLog(tx, data) {
        return tx.doctor_transfer_appointment_log.create({ data });
    }
    async createRescheduleQueueEntry(tx, data) {
        return tx.appointment_reschedule_queue.create({ data });
    }
    async createRescheduleActionLog(tx, data) {
        return tx.appointment_reschedule_action_log.create({ data });
    }
    async createNotification(tx, data) {
        return tx.appointment_notification.create({ data });
    }
    async findActiveRescheduleQueueForAppointment(appointmentId) {
        return prisma_1.default.appointment_reschedule_queue.findFirst({
            where: {
                appointment_id: appointmentId,
                status: { in: ["PENDING", "ASSIGNED"] }
            },
            orderBy: { created_at: "desc" }
        });
    }
    async lockRescheduleQueue(tx, queueId) {
        await tx.$queryRaw `SELECT id FROM appointment_reschedule_queue WHERE queue_id = ${queueId} FOR UPDATE`;
    }
    async getRescheduleQueueByIdTx(tx, queueId) {
        return tx.appointment_reschedule_queue.findUnique({
            where: { queue_id: queueId }
        });
    }
    async updateRescheduleQueue(tx, queueId, data) {
        return tx.appointment_reschedule_queue.update({
            where: { queue_id: queueId },
            data
        });
    }
    async getRescheduleQueue(query) {
        const { branchId, patientId, status, page = 1, limit = 10 } = query;
        const where = {};
        if (branchId)
            where.branch_id = branchId;
        if (patientId)
            where.patient_id = patientId;
        if (status)
            where.status = status;
        const [entries, total] = await Promise.all([
            prisma_1.default.appointment_reschedule_queue.findMany({
                where,
                include: rescheduleQueueDetailInclude,
                orderBy: { created_at: "desc" },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma_1.default.appointment_reschedule_queue.count({ where })
        ]);
        return {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            entries
        };
    }
}
exports.DoctorTransferRepository = DoctorTransferRepository;
