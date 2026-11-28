import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { generateId } from "../../utils/idGenerator";
import { GetAppointmentsQuery } from "./appointment.types";
import { NON_BLOCKING_APPOINTMENT_STATUSES, APPOINTMENT_STATUS } from "./appointment.constants";
import {
    computeHourIndexAndRange,
    formatHourSlotToken,
    parseHourSlotToken,
    timeStringToDate,
    minutesToHHmm,
    toDayOfWeek,
    parseTimeToMinutes,
    indexToLetter
} from "./appointment.utils";

const appointmentDetailInclude = {
    patient_bio_data: {
        select: {
            patient_id: true,
            patient_first_name: true,
            patient_middle_name: true,
            patient_last_name: true,
            patient_gender: true,
            patient_primary_mobile: true,
            patient_dob: true,
            patient_age: true,
            patient_blood_group: true,
            patient_photo_url: true
        }
    },

    employees: {
        select: {
            employee_id: true,
            first_name: true,
            middle_name: true,
            last_name: true,
            specialization: true,
            mobile_no: true
        }
    },

    branch: {
        select: {
            branch_id: true,
            branch_name: true,
            branch_area: true
        }
    },

    department_master: {
        select: {
            department_id: true,
            department_name: true
        }
    },

    doctor_schedule: {
        select: {
            schedule_id: true,
            day_of_week: true,
            shift_name: true,
            start_time: true,
            end_time: true,
            consultation_minutes: true
        }
    }
} satisfies Prisma.appointment_historyInclude;

const calendarAppointmentInclude = {
    patient_bio_data: {
        select: {
            patient_id: true,
            patient_first_name: true,
            patient_middle_name: true,
            patient_last_name: true,
            patient_gender: true,
            patient_primary_mobile: true,
            patient_dob: true,
            patient_age: true,
            patient_blood_group: true
            // patient_photo_url intentionally excluded to prevent base64 payload bloat (> 800 KB)
        }
    },

    employees: {
        select: {
            employee_id: true,
            first_name: true,
            middle_name: true,
            last_name: true,
            specialization: true,
            mobile_no: true
        }
    },

    branch: {
        select: {
            branch_id: true,
            branch_name: true,
            branch_area: true
        }
    },

    department_master: {
        select: {
            department_id: true,
            department_name: true
        }
    },

    doctor_schedule: {
        select: {
            schedule_id: true,
            day_of_week: true,
            shift_name: true,
            start_time: true,
            end_time: true,
            consultation_minutes: true
        }
    }
} satisfies Prisma.appointment_historyInclude;

export class AppointmentRepository {

    async findPatient(patientId: string) {

        return prisma.patient_bio_data.findUnique({
            where: { patient_id: patientId }
        });

    }

    async findEmployee(employeeId: string) {

        return prisma.employees.findUnique({

            where: { employee_id: employeeId },

            include: {
                user_table: {
                    select: { role_type: true, user_status: true }
                },
                doctor_profile: true
            }

        });

    }

    async findBranch(branchId: string) {

        return prisma.branch.findUnique({
            where: { branch_id: branchId }
        });

    }

    async findDepartment(departmentId: string) {

        return prisma.department_master.findUnique({
            where: { department_id: departmentId }
        });

    }

    async findDoctorBranchMapping(employeeId: string, branchId: string) {

        return prisma.user_branch_mapping.findFirst({
            where: {
                employee_id: employeeId,
                branch_id: branchId,
                status: 1
            }
        });

    }

    async findDoctorScheduleById(scheduleId: string | number | bigint) {
        try {
            const id = typeof scheduleId === "bigint" ? scheduleId : BigInt(scheduleId);
            return await prisma.doctor_schedule.findUnique({
                where: { schedule_id: id }
            });
        } catch {
            return null;
        }
    }

    // A doctor can have more than one active shift on the same day_of_week
    // (e.g. morning + evening), so this returns all of them, not just one.
    async findActiveDoctorSchedules(
        employeeId: string,
        branchId: string,
        dayOfWeek: string
    ) {

        return prisma.doctor_schedule.findMany({
            where: {
                employee_id: employeeId,
                branch_id: branchId,
                day_of_week: dayOfWeek,
                is_active: true
            },
            orderBy: { start_time: "asc" }
        });

    }

    // A doctor's schedules across every branch they work at, used to compute
    // their total appointment slot capacity for a given day - not scoped to
    // any single branch, since a doctor's daily capacity is a property of
    // the doctor, not of whichever branch happens to be selected.
    async findActiveDoctorSchedulesForEmployee(
        employeeId: string,
        dayOfWeek: string
    ) {

        return prisma.doctor_schedule.findMany({
            where: {
                employee_id: employeeId,
                day_of_week: dayOfWeek,
                is_active: true
            }
        });

    }

    async countBookedAppointmentsForEmployee(
        employeeId: string,
        appointmentDate: Date
    ) {

        return prisma.appointment_history.count({
            where: {
                employee_id: employeeId,
                appointment_date: appointmentDate,
                status: { notIn: NON_BLOCKING_APPOINTMENT_STATUSES }
            }
        });

    }

    async countBookedAppointmentsForEmployeeInRange(
        employeeId: string,
        startDate: Date,
        endDate: Date
    ) {

        return prisma.appointment_history.count({
            where: {
                employee_id: employeeId,
                appointment_date: { gte: startDate, lte: endDate },
                status: { notIn: NON_BLOCKING_APPOINTMENT_STATUSES }
            }
        });

    }

    // Distinct patients who have booked at least one appointment with this
    // doctor (optionally scoped to a branch). groupBy on patient_id collapses
    // repeat visits so each patient is counted only once.
    async countDistinctPatientsForEmployee(
        employeeId: string,
        branchId?: string | null
    ) {

        const groups = await prisma.appointment_history.groupBy({
            by: ["patient_id"],
            where: {
                employee_id: employeeId,
                ...(branchId ? { branch_id: branchId } : {})
            },
            _count: { patient_id: true }
        });

        return groups.length;

    }

    async findBookedAppointmentTimes(
        employeeId: string,
        appointmentDate: Date
    ) {

        const appointments = await prisma.appointment_history.findMany({
            where: {
                employee_id: employeeId,
                appointment_date: appointmentDate,
                status: { notIn: NON_BLOCKING_APPOINTMENT_STATUSES }
            },
            select: { appointment_time: true }
        });

        return appointments.map((appointment) => appointment.appointment_time);

    }

    // Serializes concurrent bookings against the same schedule so two
    // requests can never read the same MAX(token_number) and both insert it.
    async lockDoctorSchedule(
        tx: Prisma.TransactionClient,
        scheduleId: bigint
    ) {

        await tx.$queryRaw`SELECT schedule_id FROM doctor_schedule WHERE schedule_id = ${scheduleId} FOR UPDATE`;

    }

    async findDuplicateAppointment(
        employeeId: string,
        appointmentDate: Date,
        appointmentTime: Date,
        excludeAppointmentId?: string
    ) {

        return prisma.appointment_history.findFirst({
            where: {
                employee_id: employeeId,
                appointment_date: appointmentDate,
                appointment_time: appointmentTime,
                status: { notIn: NON_BLOCKING_APPOINTMENT_STATUSES },
                ...(excludeAppointmentId
                    ? { appointment_id: { not: excludeAppointmentId } }
                    : {})
            }
        });

    }

    async generateAppointmentNumber(tx: Prisma.TransactionClient) {

        return generateId(tx, "APPOINTMENT");

    }

    async findBookedAppointmentsForDate(
        employeeId: string,
        appointmentDate: Date
    ) {
        return prisma.appointment_history.findMany({
            where: {
                employee_id: employeeId,
                appointment_date: appointmentDate,
                status: { notIn: NON_BLOCKING_APPOINTMENT_STATUSES }
            },
            select: {
                appointment_id: true,
                appointment_date: true,
                appointment_time: true,
                duration_minutes: true,
                token_number: true,
                status: true
            },
            orderBy: {
                appointment_time: "asc"
            }
        });
    }

    async findBookedAppointmentsForDateTx(
        tx: Prisma.TransactionClient,
        employeeId: string,
        appointmentDate: Date
    ) {
        return tx.appointment_history.findMany({
            where: {
                employee_id: employeeId,
                appointment_date: appointmentDate,
                status: { notIn: NON_BLOCKING_APPOINTMENT_STATUSES }
            },
            select: {
                appointment_id: true,
                appointment_date: true,
                appointment_time: true,
                duration_minutes: true,
                token_number: true,
                status: true
            },
            orderBy: {
                appointment_time: "asc"
            }
        });
    }

    async getBookedDurationForHour(
        tx: Prisma.TransactionClient,
        employeeId: string,
        appointmentDate: Date,
        hourStart: Date,
        hourEnd: Date,
        excludeAppointmentId?: string
    ): Promise<number> {
        const appointments = await tx.appointment_history.findMany({
            where: {
                employee_id: employeeId,
                appointment_date: appointmentDate,
                appointment_time: {
                    gte: hourStart,
                    lt: hourEnd
                },
                status: { notIn: NON_BLOCKING_APPOINTMENT_STATUSES },
                ...(excludeAppointmentId ? { appointment_id: { not: excludeAppointmentId } } : {})
            },
            select: { duration_minutes: true }
        });
        return appointments.reduce((sum, a) => sum + (a.duration_minutes ?? 10), 0);
    }

    // Generates hourly slot tokens (e.g. 1A, 1B, 2A...) chronologically per doctor working hour.
    async generateTokenNumber(
        tx: Prisma.TransactionClient,
        scheduleId: bigint,
        appointmentDate: Date,
        employeeId?: string | null,
        appointmentTime?: Date | string | null,
        suffix?: string | null,
        excludeAppointmentId?: string
    ): Promise<string> {
        let empId = employeeId;
        let sched = null;
        if (!empId || !appointmentTime) {
            sched = await tx.doctor_schedule.findUnique({
                where: { schedule_id: scheduleId }
            });
            if (sched) {
                empId = empId || sched.employee_id;
            }
        } else {
            sched = await tx.doctor_schedule.findUnique({
                where: { schedule_id: scheduleId }
            });
        }

        if (!empId) {
            const count = await tx.appointment_history.count({
                where: { schedule_id: scheduleId, appointment_date: appointmentDate }
            });
            return `1${indexToLetter(count)}`;
        }

        // Fetch all schedules for this doctor on this day
        const dayOfWeek = toDayOfWeek(appointmentDate);
        const daySchedules = await tx.doctor_schedule.findMany({
            where: {
                employee_id: empId,
                day_of_week: dayOfWeek,
                is_active: true
            },
            orderBy: { start_time: "asc" }
        });

        const schedulesForHour =
            daySchedules.length > 0 && (!sched || daySchedules.some((s) => s.schedule_id === sched!.schedule_id))
                ? daySchedules
                : sched
                ? [sched]
                : daySchedules;

        const apptMin = appointmentTime
            ? parseTimeToMinutes(appointmentTime)
            : (sched?.start_time ? parseTimeToMinutes(sched.start_time) : 9 * 60);

        const { hourIndex, hourStartMinutes, hourEndMinutes } = computeHourIndexAndRange(
            apptMin,
            schedulesForHour
        );

        const hourStartDate = timeStringToDate(minutesToHHmm(hourStartMinutes % 1440));
        const hourEndDate = timeStringToDate(minutesToHHmm(hourEndMinutes % 1440));

        // Find existing active appointments in this hour window (excluding self on reschedule)
        const existingHourAppts = await tx.appointment_history.findMany({
            where: {
                employee_id: empId,
                appointment_date: appointmentDate,
                appointment_time: {
                    gte: hourStartDate,
                    lt: hourEndDate
                },
                status: { notIn: NON_BLOCKING_APPOINTMENT_STATUSES },
                ...(excludeAppointmentId ? { appointment_id: { not: excludeAppointmentId } } : {})
            },
            select: {
                appointment_id: true,
                appointment_time: true,
                token_number: true
            },
            orderBy: {
                appointment_time: "asc"
            }
        });

        // Collect existing slot letters in this hour
        const usedIndices = new Set<number>();
        const existingTokens = new Set<string>();
        const normalizedTargetMin = (hourEndMinutes > 1440 && apptMin < hourStartMinutes) ? apptMin + 1440 : apptMin;

        let earliestLaterSlotIndex: number | null = null;
        let latestPredecessorBase: string | null = null;

        for (const appt of existingHourAppts) {
            if (!appt.token_number) continue;
            existingTokens.add(appt.token_number.toUpperCase());

            const parsed = parseHourSlotToken(appt.token_number);
            if (!parsed || parsed.hourIndex !== hourIndex) continue;

            if (!parsed.suffix) {
                usedIndices.add(parsed.slotIndex);
            }

            let aMin = appt.appointment_time ? parseTimeToMinutes(appt.appointment_time) : hourStartMinutes;
            if (hourEndMinutes > 1440 && aMin < hourStartMinutes) {
                aMin += 1440;
            }

            if (aMin > normalizedTargetMin) {
                if (!parsed.suffix && (earliestLaterSlotIndex === null || parsed.slotIndex < earliestLaterSlotIndex)) {
                    earliestLaterSlotIndex = parsed.slotIndex;
                }
            } else {
                latestPredecessorBase = `${parsed.hourIndex}${parsed.letter}`;
            }
        }

        // Find the lowest available slot index (0 = A, 1 = B, etc.)
        let nextIndex = 0;
        while (usedIndices.has(nextIndex)) {
            nextIndex++;
        }

        // If inserting before a later appointment whose letter is <= nextIndex (e.g. 5B exists at 10:40
        // and we are booking 10:20 after 5A), use a chronological sub-token (5A-1) so 5B is preserved
        // and tokens stay strictly chronological (5A -> 5A-1 -> 5B).
        if (!suffix && earliestLaterSlotIndex !== null && nextIndex >= earliestLaterSlotIndex && latestPredecessorBase) {
            let subIndex = 1;
            while (existingTokens.has(`${latestPredecessorBase}-${subIndex}`.toUpperCase())) {
                subIndex++;
            }
            return `${latestPredecessorBase}-${subIndex}`;
        }

        return formatHourSlotToken(hourIndex, nextIndex, suffix);
    }

    async createAppointment(
        tx: Prisma.TransactionClient,
        data: Prisma.appointment_historyUncheckedCreateInput
    ) {

        return tx.appointment_history.create({ data });

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

    async updateAppointmentStatus(
        appointmentId: string,
        status: string,
        cancelReason?: string,
        cancelledBy?: string | null,
        client: Prisma.TransactionClient = prisma
    ) {

        return client.appointment_history.update({
            where: { appointment_id: appointmentId },
            data: {
                status,
                cancel_reason: cancelReason,
                ...(status === APPOINTMENT_STATUS.CANCELLED
                    ? {
                        cancelled_at: new Date(),
                        cancelled_by: cancelledBy ?? null,
                        notification_status: "NOT_REQUIRED"
                    }
                    : {})
            },
            include: appointmentDetailInclude
        });

    }

    async getAppointmentByNumber(appointmentId: string) {

        return prisma.appointment_history.findUnique({
            where: { appointment_id: appointmentId },
            include: appointmentDetailInclude
        });

    }

    async findOpenRescheduleQueueEntries(tx: Prisma.TransactionClient, appointmentId: string) {

        return tx.appointment_reschedule_queue.findMany({
            where: {
                appointment_id: appointmentId,
                status: { in: ["PENDING", "ASSIGNED"] }
            },
            orderBy: { created_at: "desc" }
        });

    }

    async closeRescheduleQueueEntry(
        tx: Prisma.TransactionClient,
        queueId: string,
        performedBy: string
    ) {

        await tx.appointment_reschedule_queue.update({
            where: { queue_id: queueId },
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

    async getAppointments(query: GetAppointmentsQuery) {

        const {
            branchId,
            employeeId,
            patientId,
            status,
            date,
            dateFrom,
            dateTo,
            sortBy = "appointment_date",
            sortOrder = "desc",
            page = 1,
            limit = 10,
            viewMode
        } = query;

        const isCalendar = viewMode === "calendar";

        const where: Prisma.appointment_historyWhereInput = {};

        if (branchId) where.branch_id = branchId;
        if (employeeId) where.employee_id = employeeId;
        if (patientId) where.patient_id = patientId;
        if (status) where.status = status;

        if (date) {

            where.appointment_date = parseDate(date);

        } else if (dateFrom || dateTo) {

            where.appointment_date = {
                ...(dateFrom ? { gte: parseDate(dateFrom) } : {}),
                ...(dateTo ? { lte: parseDate(dateTo) } : {})
            };

        }

        const orderBy: Prisma.appointment_historyOrderByWithRelationInput | Prisma.appointment_historyOrderByWithRelationInput[] =
            sortBy === "created_at"
                ? { created_at: sortOrder }
                : sortBy === "token_number"
                ? { token_number: sortOrder }
                : sortBy === "status"
                ? { status: sortOrder }
                : [
                    { appointment_date: sortOrder },
                    { appointment_time: "asc" },
                    { token_number: "asc" },
                ];

        const [appointments, total] = await Promise.all([

            prisma.appointment_history.findMany({
                where,
                include: isCalendar ? calendarAppointmentInclude : appointmentDetailInclude,
                ...(isCalendar
                    ? {
                        omit: {
                            diagnosis_text: true,
                            prescription_details: true,
                            chemo_fitness: true,
                            chemo_unfit_notes: true,
                            lab_test_details: true,
                            scan_details: true,
                            chief_complaint: true,
                            symptoms: true
                        }
                    }
                    : {}),
                orderBy,
                skip: (page - 1) * limit,
                take: limit
            }),

            prisma.appointment_history.count({ where })

        ]);

        return {

            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            appointments

        };

    }

}

function parseDate(date: string): Date {
    return new Date(date);
}
