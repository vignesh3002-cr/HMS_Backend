import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { generateId } from "../../utils/idGenerator";
import { TERMINAL_APPOINTMENT_STATUSES } from "../appointment/appointment.constants";
import { GetRescheduleQueueQuery } from "./doctorTransfer.types";

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

} satisfies Prisma.appointment_reschedule_queueInclude;

export class DoctorTransferRepository {

    async findDoctorWithRole(employeeId: string) {

        return prisma.employees.findUnique({
            where: { employee_id: employeeId },
            include: {
                user_table: { select: { user_id: true, role_type: true, user_status: true } },
                doctor_profile: true
            }
        });

    }

    // Match on employee_id OR user_id: mappings created before the
    // employee_id column was populated may only carry user_id.
    private mappingWhere(employeeId: string, userId?: string | null) {

        return userId
            ? { OR: [{ employee_id: employeeId }, { user_id: userId }] }
            : { employee_id: employeeId };

    }

    async findAnyActiveBranchMapping(employeeId: string, userId?: string | null) {

        return prisma.user_branch_mapping.findFirst({
            where: {
                ...this.mappingWhere(employeeId, userId),
                status: 1
            },
            orderBy: { assigned_date: "desc" }
        });

    }

    async findPendingTransfer(employeeId: string) {

        return prisma.doctor_transfer.findFirst({
            where: {
                employee_id: employeeId,
                status: "PENDING_CONFIRMATION"
            },
            orderBy: { requested_at: "desc" }
        });

    }

    async findActiveBranchMapping(employeeId: string, branchId: string, userId?: string | null) {

        return prisma.user_branch_mapping.findFirst({
            where: {
                ...this.mappingWhere(employeeId, userId),
                branch_id: branchId,
                status: 1
            }
        });

    }

    async findActiveBranch(branchId: string) {

        return prisma.branch.findFirst({
            where: { branch_id: branchId, branch_status: "Active" }
        });

    }

    async findDepartment(departmentId: string) {

        return prisma.department_master.findUnique({
            where: { department_id: departmentId }
        });

    }

    async findPatient(patientId: string) {

        return prisma.patient_bio_data.findUnique({
            where: { patient_id: patientId }
        });

    }

    async findAllActiveSchedules(employeeId: string) {

        return prisma.doctor_schedule.findMany({
            where: { employee_id: employeeId, is_active: true }
        });

    }

    async findAllActiveSchedulesInTx(tx: Prisma.TransactionClient, employeeId: string) {

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
    async findEligibleReplacementCandidates(
        branchId: string,
        departmentId: string,
        excludeEmployeeId: string,
        dayOfWeek: string
    ) {

        return prisma.doctor_schedule.findMany({
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

    async findFutureAppointments(
        employeeId: string,
        effectiveDate: Date,
        page = 1,
        limit = 50
    ) {

        const where: Prisma.appointment_historyWhereInput = {
            employee_id: employeeId,
            appointment_date: { gte: effectiveDate },
            status: { notIn: TERMINAL_APPOINTMENT_STATUSES }
        };

        const [appointments, total] = await Promise.all([

            prisma.appointment_history.findMany({
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

            prisma.appointment_history.count({ where })

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
    /**
     * Data needed to compute which appointments a DATE_CHANGE would strand:
     * the recurring template rows for that branch plus every active
     * schedule-change on the exact date (optionally excluding the row being
     * updated/deleted).
     */
    async fetchDataForDateChangeImpact(
        employeeId: string,
        branchId: string,
        changeDate: Date,
        excludeChangeId?: bigint
    ) {
        const [templateSchedules, activeChanges] = await Promise.all([
            prisma.doctor_schedule.findMany({
                where: {
                    employee_id: employeeId,
                    branch_id: branchId,
                    is_active: true
                },
                select: { day_of_week: true, start_time: true, end_time: true }
            }),
            prisma.doctor_schedule_change.findMany({
                where: {
                    employee_id: employeeId,
                    branch_id: branchId,
                    change_date: changeDate,
                    is_active: true
                },
                select: {
                    change_id: true,
                    mode: true,
                    start_time: true,
                    end_time: true
                }
            })
        ]);

        const changes = excludeChangeId
            ? activeChanges.filter((chg) => chg.change_id !== excludeChangeId)
            : activeChanges;

        return { templateSchedules, changes };
    }

    /** Appointments booked for this doctor+branch ON the exact change date
     *  (today or later), excluding terminal statuses - these are the rows
     *  a date-change could strand. */
    async findDayAppointments(
        employeeId: string,
        branchId: string,
        changeDate: Date
    ) {
        const dayEnd = new Date(changeDate.getTime() + 24 * 60 * 60 * 1000);

        return prisma.appointment_history.findMany({
            where: {
                employee_id: employeeId,
                branch_id: branchId,
                appointment_date: { gte: changeDate, lt: dayEnd },
                OR: [
                    { status: null },
                    { status: { notIn: TERMINAL_APPOINTMENT_STATUSES } }
                ]
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
                        patient_last_name: true,
                        patient_primary_mobile: true
                    }
                }
            },
            orderBy: { appointment_time: "asc" }
        });
    }    async findFutureAppointmentsByScheduleIds(
        scheduleIds: bigint[],
        effectiveDate: Date,
        options?: {
            employeeId?: string;
            branchIds?: string[];
            includeAllAtBranches?: boolean;
        },
        page = 1,
        limit = 200
    ) {

        const fallbackConds: Prisma.appointment_historyWhereInput[] = [];

        if (options?.branchIds?.length) {

            if (options.includeAllAtBranches) {

                fallbackConds.push({
                    employee_id: options.employeeId,
                    branch_id: { in: options.branchIds }
                });

            } else {

                fallbackConds.push({
                    schedule_id: null,
                    branch_id: { in: options.branchIds }
                });

            }

        }

        const where: Prisma.appointment_historyWhereInput = {
            appointment_date: { gte: effectiveDate },
            status: { notIn: TERMINAL_APPOINTMENT_STATUSES },
            OR: [
                { schedule_id: { in: scheduleIds } },
                ...fallbackConds
            ]
        };

        const [appointments, total] = await Promise.all([

            prisma.appointment_history.findMany({
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

            prisma.appointment_history.count({ where })

        ]);

        return { appointments, total };

    }

    async findAllFutureAppointmentsForTransferByScheduleIds(
        tx: Prisma.TransactionClient,
        scheduleIds: bigint[],
        effectiveDate: Date,
        options?: {
            employeeId?: string;
            branchIds?: string[];
            includeAllAtBranches?: boolean;
        }
    ) {

        const fallbackConds: Prisma.appointment_historyWhereInput[] = [];

        if (options?.branchIds?.length) {

            if (options.includeAllAtBranches) {

                fallbackConds.push({
                    employee_id: options.employeeId,
                    branch_id: { in: options.branchIds }
                });

            } else {

                fallbackConds.push({
                    schedule_id: null,
                    branch_id: { in: options.branchIds }
                });

            }

        }

        return tx.appointment_history.findMany({
            where: {
                appointment_date: { gte: effectiveDate },
                status: { notIn: TERMINAL_APPOINTMENT_STATUSES },
                OR: [
                    { schedule_id: { in: scheduleIds } },
                    ...fallbackConds
                ]
            },
            orderBy: { appointment_date: "asc" }
        });

    }

    async lockAppointment(tx: Prisma.TransactionClient, appointmentId: string) {

        await tx.$queryRaw`SELECT id FROM appointment_history WHERE appointment_id = ${appointmentId} FOR UPDATE`;

    }

    async lockDoctorTransfer(tx: Prisma.TransactionClient, transferId: string) {

        await tx.$queryRaw`SELECT id FROM doctor_transfer WHERE transfer_id = ${transferId} FOR UPDATE`;

    }

    async generateTransferId(tx: Prisma.TransactionClient) {

        return generateId(tx, "DOCTOR_TRANSFER");

    }

    async generateQueueId(tx: Prisma.TransactionClient) {

        return generateId(tx, "RESCHEDULE_QUEUE");

    }

    async generateNotificationId(tx: Prisma.TransactionClient) {

        return generateId(tx, "NOTIFICATION");

    }

    async createDoctorTransfer(
        tx: Prisma.TransactionClient,
        data: Prisma.doctor_transferUncheckedCreateInput
    ) {

        return tx.doctor_transfer.create({ data });

    }

    async updateDoctorTransfer(
        tx: Prisma.TransactionClient,
        transferId: string,
        data: Prisma.doctor_transferUncheckedUpdateInput
    ) {

        return tx.doctor_transfer.update({
            where: { transfer_id: transferId },
            data
        });

    }

    async getDoctorTransferById(transferId: string) {

        return prisma.doctor_transfer.findUnique({
            where: { transfer_id: transferId }
        });

    }

    async closeBranchMapping(
        tx: Prisma.TransactionClient,
        employeeId: string,
        branchId: string,
        effectiveTo: Date,
        userId?: string | null
    ) {

        await tx.user_branch_mapping.updateMany({
            where: {
                ...this.mappingWhere(employeeId, userId),
                branch_id: branchId,
                status: 1
            },
            data: { status: 0, effective_to: effectiveTo }
        });

    }

    async createBranchMapping(
        tx: Prisma.TransactionClient,
        data: Prisma.user_branch_mappingUncheckedCreateInput
    ) {

        return tx.user_branch_mapping.create({ data });

    }

    async findSchedulesByIds(tx: Prisma.TransactionClient, scheduleIds: bigint[]) {

        return tx.doctor_schedule.findMany({
            where: { schedule_id: { in: scheduleIds } },
            select: { schedule_id: true, branch_id: true }
        });

    }

    async closeSchedulesByIds(
        tx: Prisma.TransactionClient,
        scheduleIds: bigint[],
        effectiveTo: Date,
        deletedBy?: string | null
    ) {

        await tx.doctor_schedule.updateMany({
            where: { schedule_id: { in: scheduleIds } },
            data: { is_active: false, effective_to: effectiveTo, ...(deletedBy ? { deleted_by: deletedBy } : {}) }
        });

    }

    // Closes EVERY active schedule a doctor still has at one branch — used
    // when a doctor is actually transferred away from a branch, so no active
    // slot keeps them visible/available there (mapping alone is closed too).
    async closeSchedulesAtBranch(
        tx: Prisma.TransactionClient,
        employeeId: string,
        branchId: string,
        effectiveTo: Date,
        deletedBy?: string | null
    ) {

        await tx.doctor_schedule.updateMany({
            where: { employee_id: employeeId, branch_id: branchId, is_active: true },
            data: { is_active: false, effective_to: effectiveTo, ...(deletedBy ? { deleted_by: deletedBy } : {}) }
        });

    }

    async countActiveSchedulesAtBranch(
        tx: Prisma.TransactionClient,
        employeeId: string,
        branchId: string
    ) {

        return tx.doctor_schedule.count({
            where: { employee_id: employeeId, branch_id: branchId, is_active: true }
        });

    }

    async createDoctorSchedule(
        tx: Prisma.TransactionClient,
        data: Prisma.doctor_scheduleUncheckedCreateInput
    ) {

        return tx.doctor_schedule.create({ data });

    }

    async updateEmployeeBranchDept(
        tx: Prisma.TransactionClient,
        employeeId: string,
        data: { branch_id: string; department_id?: string }
    ) {

        return tx.employees.update({
            where: { employee_id: employeeId },
            data
        });

    }

    async updateAppointment(
        tx: Prisma.TransactionClient,
        appointmentId: string,
        data: Prisma.appointment_historyUncheckedUpdateInput
    ) {

        return tx.appointment_history.update({
            where: { appointment_id: appointmentId },
            data
        });

    }

    async createTransferAppointmentLog(
        tx: Prisma.TransactionClient,
        data: Prisma.doctor_transfer_appointment_logUncheckedCreateInput
    ) {

        return tx.doctor_transfer_appointment_log.create({ data });

    }

    async createRescheduleQueueEntry(
        tx: Prisma.TransactionClient,
        data: Prisma.appointment_reschedule_queueUncheckedCreateInput
    ) {

        return tx.appointment_reschedule_queue.create({ data });

    }

    async createRescheduleActionLog(
        tx: Prisma.TransactionClient,
        data: Prisma.appointment_reschedule_action_logUncheckedCreateInput
    ) {

        return tx.appointment_reschedule_action_log.create({ data });

    }

    async createNotification(
        tx: Prisma.TransactionClient,
        data: Prisma.appointment_notificationUncheckedCreateInput
    ) {

        return tx.appointment_notification.create({ data });

    }

    async findActiveRescheduleQueueForAppointment(appointmentId: string) {

        return prisma.appointment_reschedule_queue.findFirst({
            where: {
                appointment_id: appointmentId,
                status: { in: ["PENDING", "ASSIGNED"] }
            },
            orderBy: { created_at: "desc" }
        });

    }

    async lockRescheduleQueue(tx: Prisma.TransactionClient, queueId: string) {

        await tx.$queryRaw`SELECT id FROM appointment_reschedule_queue WHERE queue_id = ${queueId} FOR UPDATE`;

    }

    async getRescheduleQueueByIdTx(tx: Prisma.TransactionClient, queueId: string) {

        return tx.appointment_reschedule_queue.findUnique({
            where: { queue_id: queueId }
        });

    }

    async updateRescheduleQueue(
        tx: Prisma.TransactionClient,
        queueId: string,
        data: Prisma.appointment_reschedule_queueUncheckedUpdateInput
    ) {

        return tx.appointment_reschedule_queue.update({
            where: { queue_id: queueId },
            data
        });

    }

    async getRescheduleQueue(query: GetRescheduleQueueQuery) {

        const {
            branchId,
            patientId,
            status,
            page = 1,
            limit = 10
        } = query;

        const where: Prisma.appointment_reschedule_queueWhereInput = {};

        if (branchId) where.branch_id = branchId;
        if (patientId) where.patient_id = patientId;
        if (status) where.status = status;

        const [entries, total] = await Promise.all([

            prisma.appointment_reschedule_queue.findMany({
                where,
                include: rescheduleQueueDetailInclude,
                orderBy: { created_at: "desc" },
                skip: (page - 1) * limit,
                take: limit
            }),

            prisma.appointment_reschedule_queue.count({ where })

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
