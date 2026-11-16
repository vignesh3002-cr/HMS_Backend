import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { AppointmentRepository } from "./appointment.repository";
import {
    CreateAppointmentDTO,
    UpdateAppointmentDTO,
    GetAppointmentsQuery,
    UpdateChemoFitnessDTO
} from "./appointment.types";
import {
    APPOINTMENT_STATUS,
    TERMINAL_APPOINTMENT_STATUSES,
    DEFAULT_VISIT_DURATIONS
} from "./appointment.constants";
import {
    toDayOfWeek,
    timeStringToDate,
    timeStringToMinutes,
    timeToMinutes,
    formatTimeOfDay,
    generateTimeSlots,
    parseDateOnly,
    formatDateOnly,
    addDays,
    getWeekRange,
    getTodayInIST,
    getNowMinutesInIST,
    formatMinutesTo12Hour,
    minutesToHHmm
} from "./appointment.utils";
import { generateId } from "../../utils/idGenerator";
import { getBranchTimezone, getNowMinutesIn, getTodayIn } from "../../utils/timezone";
import { LEAVE_STATUS } from "../doctorLeave/doctorLeave.constants";
import { IpdService } from "../ipd/ipd.service";

const repository = new AppointmentRepository();

/**
 * Fixed slot length used for doctor capacity summaries.
 */
const SLOT_DURATION_MINUTES = 20;

type DoctorSchedule = Awaited<
    ReturnType<AppointmentRepository["findActiveDoctorSchedules"]>
>[number];

/**
 * Booking context used by appointment creation/update.
 */
interface BookingContext {
    employee: NonNullable<
        Awaited<ReturnType<AppointmentRepository["findEmployee"]>>
    >;

    branch: NonNullable<
        Awaited<ReturnType<AppointmentRepository["findBranch"]>>
    >;

    department:
        Awaited<
            ReturnType<AppointmentRepository["findDepartment"]>
        > | null;

    schedules: DoctorSchedule[];
}

/**
 * Effective schedule after ADD / OVERRIDE / CANCEL
 * changes have been applied.
 */
interface EffectiveSchedule {
    schedule_id: bigint;
    shift_name: string;
    start_time: Date;
    end_time: Date;
    consultation_minutes: number;
    day_of_week?: string | null;
}

/**
 * Converts PostgreSQL TIME represented as Date into minutes.
 */
function dateToMinutes(value: Date): number {
    return (
        value.getUTCHours() * 60 +
        value.getUTCMinutes()
    );
}

/**
 * Converts minutes since midnight into a Date
 * suitable for @db.Time.
 */
function minutesToTimeDate(minutes: number): Date {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    const result = new Date(0);

    result.setUTCHours(
        hours,
        mins,
        0,
        0
    );

    return result;
}

/**
 * Checks whether two time ranges overlap.
 */
/** End of a window in minutes, rolled into the next day when it passes midnight. */
function spanEnd(start: number, end: number): number {
    return end <= start ? end + 24 * 60 : end;
}

function rangesOverlap(
    start1: number,
    end1: number,
    start2: number,
    end2: number
): boolean {
    return (
        start1 < end2 &&
        end1 > start2
    );
}

/**
 * Returns active schedule changes for a doctor,
 * branch and exact date.
 */
async function getScheduleChanges(
    employeeId: string,
    branchId: string,
    date: Date
) {
    return prisma.doctor_schedule_change.findMany({
        where: {
            employee_id: employeeId,
            branch_id: branchId,
            change_date: date,
            is_active: true
        },
        orderBy: {
            created_at: "asc"
        }
    });
}

/**
 * Finds an existing doctor_schedule row that can be
 * used as the schedule_id reference for an ADD/OVERRIDE
 * date that has no normal schedule on that weekday.
 *
 * appointment_history.schedule_id references
 * doctor_schedule.
 */
async function findReferenceSchedule(
    employeeId: string,
    branchId: string
): Promise<DoctorSchedule | null> {

    const schedule =
        await prisma.doctor_schedule.findFirst({
            where: {
                employee_id: employeeId,
                branch_id: branchId,
                is_active: true
            },
            orderBy: {
                start_time: "asc"
            }
        });

    if (schedule) {
        return schedule as DoctorSchedule | null;
    }

    // Fallback anchor: an ADD/OVERRIDE-only date at a branch where the
    // doctor has no OTHER recurring row still needs a real doctor_schedule
    // row for appointment_history.schedule_id. Any active row of this
    // doctor works as that anchor - the appointment itself keeps its own
    // branch_id, so this does not move the booking to another branch.
    const anyActiveSchedule =
        await prisma.doctor_schedule.findFirst({
            where: {
                employee_id: employeeId,
                is_active: true
            },
            orderBy: [
                {
                    branch_id: "asc"
                },
                {
                    start_time: "asc"
                }
            ]
        });

    return anyActiveSchedule as DoctorSchedule | null;
}

/**
 * Converts normal weekly schedules into
 * EffectiveSchedule format.
 */
function convertNormalSchedules(
    schedules: DoctorSchedule[]
): EffectiveSchedule[] {

    return schedules
        .filter(
            (schedule) =>
                schedule.start_time &&
                schedule.end_time
        )
        .map(
            (schedule) => ({
                schedule_id:
                    schedule.schedule_id,

                shift_name:
                    schedule.shift_name ??
                    "NORMAL",

                start_time:
                    schedule.start_time!,

                end_time:
                    schedule.end_time!,

                consultation_minutes:
                    schedule.consultation_minutes ??
                    20,

                day_of_week:
                    schedule.day_of_week
            })
        );
}

/**
 * Applies ADD / OVERRIDE / CANCEL changes to
 * the normal schedule.
 *
 * Rules:
 *
 * NORMAL
 *     -> normal weekly schedule
 *
 * ADD
 *     -> normal + additional range
 *
 * OVERRIDE
 *     -> override replaces normal
 *
 * CANCEL
 *     -> entire date is cancelled
 *
 * OVERRIDE + ADD
 *     -> override + additional range
 *
 * CANCEL has absolute priority.
 */
async function getEffectiveSchedules(
    employeeId: string,
    branchId: string,
    appointmentDate: Date,
    normalSchedules: DoctorSchedule[]
): Promise<EffectiveSchedule[]> {

    const changes =
        await getScheduleChanges(
            employeeId,
            branchId,
            appointmentDate
        );

    /**
     * No date-specific changes.
     *
     * Use the normal weekly schedule.
     */
    if (changes.length === 0) {

        return convertNormalSchedules(
            normalSchedules
        );
    }

    /**
     * CANCEL has absolute priority.
     *
     * Cancellation is for the entire date.
     *
     * Example:
     * Normal schedule:
     * 09:00 - 13:00
     * 14:00 - 18:00
     *
     * CANCEL on that date:
     * No slots for the entire day.
     */
    const hasCancel =
        changes.some(
            (change) =>
                change.mode === "CANCEL"
        );

    if (hasCancel) {
        return [];
    }

    /**
     * Find a valid doctor_schedule reference.
     *
     * Normally we use the schedule from the selected
     * weekday.
     *
     * If the selected weekday has no normal schedule,
     * we use another active schedule belonging to the
     * same doctor and branch.
     */
    let referenceSchedule:
        DoctorSchedule | null =
        normalSchedules.find(
            (schedule) =>
                schedule.start_time &&
                schedule.end_time
        ) ?? null;

    if (!referenceSchedule) {

        referenceSchedule =
            await findReferenceSchedule(
                employeeId,
                branchId
            );
    }

    /**
     * If there is no doctor_schedule at all for this
     * doctor/branch, we cannot safely create an
     * appointment because appointment_history.schedule_id
     * requires a real doctor_schedule row.
     */
    if (!referenceSchedule) {
        return [];
    }

    const consultationMinutes =
        referenceSchedule.consultation_minutes ??
        20;

    /**
     * OVERRIDE changes.
     */
    const overrideChanges =
        changes.filter(
            (change) =>
                change.mode === "OVERRIDE" &&
                change.start_time &&
                change.end_time
        );

    /**
     * ADD changes.
     */
    const addChanges =
        changes.filter(
            (change) =>
                change.mode === "ADD" &&
                change.start_time &&
                change.end_time
        );

    let effectiveSchedules:
        EffectiveSchedule[];

    /**
     * OVERRIDE replaces the normal schedule.
     *
     * This also works when normalSchedules is empty.
     */
    if (overrideChanges.length > 0) {

        effectiveSchedules =
            overrideChanges
                .map(
                    (change): EffectiveSchedule | null => {

                        if (
                            !change.start_time ||
                            !change.end_time
                        ) {
                            return null;
                        }

                        const startMinutes =
                            dateToMinutes(
                                change.start_time
                            );

                        const endMinutes =
                            dateToMinutes(
                                change.end_time
                            );

                        // An end before the start is an overnight window (it runs
                        // past midnight); only a zero-length window is invalid.
                        if (
                            endMinutes ===
                            startMinutes
                        ) {
                            return null;
                        }

                        return {
                            schedule_id:
                                referenceSchedule!.schedule_id,

                            shift_name:
                                "OVERRIDE",

                            start_time:
                                change.start_time,

                            end_time:
                                change.end_time,

                            consultation_minutes:
                                consultationMinutes
                        };
                    }
                )
                .filter(
                    (
                        schedule
                    ): schedule is EffectiveSchedule =>
                        schedule !== null
                );

    } else {

        /**
         * No override.
         *
         * Keep the normal weekly schedule.
         *
         * If there is no normal schedule, this will
         * initially be empty. ADD can then create the
         * effective schedule below.
         */
        effectiveSchedules =
            convertNormalSchedules(
                normalSchedules
            );
    }

    /**
     * ADD appends additional working time.
     *
     * ADD can work even if there is no normal
     * schedule on that particular weekday.
     */
    for (
        const change of addChanges
    ) {

        if (
            !change.start_time ||
            !change.end_time
        ) {
            continue;
        }

        const startMinutes =
            dateToMinutes(
                change.start_time
            );

        const endMinutes =
            dateToMinutes(
                change.end_time
            );

        /**
         * Ignore zero-length ranges. An end before the start is an
         * overnight window that runs past midnight.
         */
        if (
            endMinutes ===
            startMinutes
        ) {
            continue;
        }

        /**
         * Prevent overlapping ADD/OVERRIDE ranges
         * from generating duplicate slots.
         */
        const alreadyCovered =
            effectiveSchedules.some(
                (schedule) =>
                    rangesOverlap(
                        startMinutes,
                        spanEnd(startMinutes, endMinutes),
                        dateToMinutes(
                            schedule.start_time
                        ),
                        spanEnd(
                            dateToMinutes(schedule.start_time),
                            dateToMinutes(schedule.end_time)
                        )
                    )
            );

        if (alreadyCovered) {
            continue;
        }

        effectiveSchedules.push({
            schedule_id:
                referenceSchedule.schedule_id,

            shift_name:
                "ADD",

            start_time:
                change.start_time,

            end_time:
                change.end_time,

            consultation_minutes:
                consultationMinutes
        });
    }

    /**
     * Sort schedules chronologically.
     */
    effectiveSchedules.sort(
        (a, b) =>
            dateToMinutes(
                a.start_time
            ) -
            dateToMinutes(
                b.start_time
            )
    );

    return effectiveSchedules;
}

export class AppointmentService {

    /**
     * Validates doctor, branch, department and
     * effective schedule.
     */
    /*
     * PENDING or APPROVED leave covering the given date.
     * Both block new bookings; REJECTED leaves never do.
     */
    private async getBlockingLeaveForDate(
        employeeId: string,
        date: Date
    ) {
        return prisma.doctor_leave.findFirst({
            where: {
                employee_id: employeeId,
                status: {
                    in: [
                        LEAVE_STATUS.PENDING,
                        LEAVE_STATUS.APPROVED
                    ]
                },
                leave_start_date: { lte: date },
                leave_end_date: { gte: date }
            }
        });
    }

    private async validateBookingContext(
        employeeId: string,
        branchId: string,
        departmentId: string | undefined,
        appointmentDate: Date,
        scheduleId?: string,
        appointmentTime?: string
    ): Promise<BookingContext> {

        const employee =
            await repository.findEmployee(
                employeeId
            );

        if (!employee) {
            throw new Error(
                "Doctor not found"
            );
        }

        if (
            employee.user_table?.role_type !==
            "DOCTOR"
        ) {
            throw new Error(
                "Selected employee is not a doctor"
            );
        }

        if (
            employee.emp_status !== true
        ) {
            throw new Error(
                "Doctor is inactive. Please contact the administrator."
            );
        }

        const branch =
            await repository.findBranch(
                branchId
            );

        if (!branch) {
            throw new Error(
                "Branch not found"
            );
        }

        if (
            branch.branch_status !==
            "Active"
        ) {
            throw new Error(
                "Selected branch is inactive"
            );
        }

        const mapping =
            await repository.findDoctorBranchMapping(
                employeeId,
                branchId
            );

        if (!mapping) {
            throw new Error(
                "Doctor is not assigned to the selected branch"
            );
        }

        let department = null;

        if (departmentId) {

            department =
                await repository.findDepartment(
                    departmentId
                );

            if (!department) {
                throw new Error(
                    "Department not found"
                );
            }
        }

        /*
         * PENDING/APPROVED leaves block booking for the
         * whole date range they cover.
         */
        const blockingLeave =
            await this.getBlockingLeaveForDate(
                employeeId,
                appointmentDate
            );

        if (blockingLeave) {
            throw new Error(
                "Doctor is on leave on the selected date"
            );
        }

        const dayOfWeek =
            toDayOfWeek(
                appointmentDate
            );

        const normalSchedules =
            await repository.findActiveDoctorSchedules(
                employeeId,
                branchId,
                dayOfWeek
            );

        const schedules =
            await getEffectiveSchedules(
                employeeId,
                branchId,
                appointmentDate,
                normalSchedules
            );

        if (scheduleId) {
            const direct = await repository.findDoctorScheduleById(scheduleId);
            if (direct && direct.employee_id === employeeId && direct.branch_id === branchId && direct.is_active) {
                if (!schedules.some((s) => s.schedule_id === direct.schedule_id)) {
                    schedules.unshift({
                        schedule_id: direct.schedule_id,
                        shift_name: direct.shift_name ?? "General Shift",
                        start_time: direct.start_time,
                        end_time: direct.end_time,
                        consultation_minutes: direct.consultation_minutes ?? 20,
                        day_of_week: direct.day_of_week
                    });
                }
            }
        }

        const apptMinutes = appointmentTime ? timeToMinutes(appointmentTime) : 0;
        if (schedules.length === 0 || apptMinutes < 720) {
            const yesterday = addDays(appointmentDate, -1);
            const yesterdayDayOfWeek = toDayOfWeek(yesterday);
            const yesterdayNormal = await repository.findActiveDoctorSchedules(
                employeeId,
                branchId,
                yesterdayDayOfWeek
            );
            const yesterdayEffective = await getEffectiveSchedules(
                employeeId,
                branchId,
                yesterday,
                yesterdayNormal
            );
            const overnightSchedules = yesterdayEffective.filter((s) => {
                if (!s.start_time || !s.end_time) return false;
                return timeToMinutes(s.end_time) <= timeToMinutes(s.start_time);
            });
            for (const os of overnightSchedules) {
                if (!schedules.some((s) => s.schedule_id === os.schedule_id)) {
                    schedules.push({
                        ...os,
                        day_of_week: os.day_of_week ?? yesterdayDayOfWeek
                    });
                }
            }
        }

        if (
            schedules.length === 0
        ) {

            const changes =
                await getScheduleChanges(
                    employeeId,
                    branchId,
                    appointmentDate
                );

            const hasCancel =
                changes.some(
                    (change) =>
                        change.mode ===
                        "CANCEL"
                );

            if (hasCancel) {
                throw new Error(
                    "Doctor is unavailable on the selected date"
                );
            }

            throw new Error(
                `Doctor has no active schedule at this branch on ${dayOfWeek}`
            );
        }

        /**
         * Convert effective schedules into the
         * shape expected by the existing booking logic.
         */
        const convertedSchedules =
            schedules.map(
                (schedule) => ({
                    ...schedule,
                    consultation_minutes:
                        schedule.consultation_minutes
                })
            ) as unknown as DoctorSchedule[];

        return {
            employee,
            branch,
            department,
            schedules:
                convertedSchedules
        };
    }

    /**
     * Finds the effective schedule containing
     * the requested appointment time.
     */
    private pickScheduleForTime(
        schedules: DoctorSchedule[],
        appointmentTime: string
    ): DoctorSchedule {

        const requestedMinutes =
            timeToMinutes(
                timeStringToDate(
                    appointmentTime
                )
            );

        const match =
            schedules.find(
                (schedule) => {

                    if (
                        !schedule.start_time ||
                        !schedule.end_time
                    ) {
                        return false;
                    }

                    const startMinutes =
                        timeToMinutes(
                            schedule.start_time
                        );

                    const endMinutes =
                        timeToMinutes(
                            schedule.end_time
                        );

                    // Overnight window (e.g. 22:00-02:00): the slots listed after
                    // midnight (00:00-02:00) belong to the same booking day.
                    if (endMinutes <= startMinutes) {
                        return (
                            requestedMinutes >= startMinutes ||
                            requestedMinutes < endMinutes
                        );
                    }

                    return (
                        requestedMinutes >=
                        startMinutes &&
                        requestedMinutes <
                        endMinutes
                    );
                }
            );

        if (!match) {
            throw new Error(
                "Selected time is outside the doctor's working hours"
            );
        }

        return match;
    }

    /**
     * Creates an appointment.
     */
    async bookAppointment(
        data: CreateAppointmentDTO,
        createdBy: string
    ) {

        const patient =
            await repository.findPatient(
                data.patient_id
            );

        if (!patient) {
            throw new Error(
                "Patient not found"
            );
        }

        const appointmentDate =
            parseDateOnly(
                data.appointment_date
            );

        // "Past date" is judged against TODAY IN THE BRANCH'S OWN timezone
        // (branch.timezone), never the server's zone or a hardcoded offset.
        if (
            formatDateOnly(appointmentDate) <
            getTodayIn(await getBranchTimezone(data.branch_id))
        ) {
            throw new Error(
                "Appointments cannot be booked for a past date"
            );
        }

        if (data.patient_visit_type === "Lab Visit") {
            const appointmentTime = timeStringToDate(data.appointment_time);
            const branch = await repository.findBranch(data.branch_id);
            if (!branch) {
                throw new Error("Branch not found");
            }

            let deptId = data.department_id;
            if (!deptId) {
                const labDept = await prisma.department_master.findFirst({
                    where: {
                        branch_id: data.branch_id,
                        department_name: { contains: "Lab", mode: "insensitive" }
                    }
                });
                deptId = labDept?.department_id;
            }

            return this.transformAppointmentFields(
                await prisma.$transaction(async (tx) => {
                    const appointmentId = await repository.generateAppointmentNumber(tx);
                    const countToday = await tx.appointment_history.count({
                        where: {
                            branch_id: data.branch_id,
                            appointment_date: appointmentDate,
                        }
                    });
                    const tokenNumber = countToday + 1;

                    const appointment = await repository.createAppointment(
                        tx,
                        {
                            appointment_id: appointmentId,
                            patient_id: data.patient_id,
                            employee_id: null,
                            branch_id: data.branch_id,
                            department_id: deptId,
                            schedule_id: null,
                            appointment_date: appointmentDate,
                            appointment_time: appointmentTime,
                            duration_minutes: Number(data.duration_minutes) || 10,
                            token_number: tokenNumber,
                            status: APPOINTMENT_STATUS.SCHEDULED,
                            reason_for_visit: data.reason_for_visit || "Lab Visit",
                            referred_by: data.referred_by,
                            booking_source: data.booking_source ?? "STAFF",
                            doctor_name: "-",
                            created_by: createdBy,
                            Patient_visit_type: data.patient_visit_type,
                            Patient_type: data.patient_type,
                        }
                    );

                    return appointment;
                })
            );
        }

        const {
            employee,
            department,
            schedules
        } =
            await this.validateBookingContext(
                data.employee_id!,
                data.branch_id,
                data.department_id,
                appointmentDate,
                data.schedule_id,
                data.appointment_time
            );

        /**
         * Validates ADD / OVERRIDE / CANCEL.
         */
        const schedule =
            this.pickScheduleForTime(
                schedules,
                data.appointment_time
            );

        const scheduleDayOfWeek = (schedule.day_of_week ?? "").trim().toUpperCase();
        const bookingDayOfWeek = toDayOfWeek(appointmentDate);
        const shiftStartMinPre = timeToMinutes(schedule.start_time!);
        let shiftEndMinPre = timeToMinutes(schedule.end_time!);
        if (shiftEndMinPre <= shiftStartMinPre) shiftEndMinPre += 1440;
        const apptMinPre = timeToMinutes(data.appointment_time);

        const isOvernight = shiftEndMinPre > 1440;
        const isPostMidnightTime = apptMinPre < shiftStartMinPre;
        const isFromYesterdayShift = isOvernight && isPostMidnightTime && (
            (scheduleDayOfWeek !== "" && scheduleDayOfWeek !== bookingDayOfWeek) ||
            (scheduleDayOfWeek === "" && bookingDayOfWeek !== toDayOfWeek(addDays(appointmentDate, -1)))
        );
        const shiftBaseDate = isFromYesterdayShift ? addDays(appointmentDate, -1) : appointmentDate;

        const appointmentTime =
            timeStringToDate(
                data.appointment_time
            );

        const durationMinutes = Number(data.duration_minutes) ||
            DEFAULT_VISIT_DURATIONS[data.patient_visit_type ?? ""] ||
            10;

        const doctorName =
            `${employee.first_name} ${employee.last_name}`.trim();

        const bookedAppointment = this.transformAppointmentFields(
            await prisma.$transaction(
                async (tx) => {

                    await repository.lockDoctorSchedule(
                        tx,
                        schedule.schedule_id
                    );

                    const apptMinutes = timeToMinutes(appointmentTime);
                    const shiftStartMin = timeToMinutes(schedule.start_time!);
                    let shiftEndMin = timeToMinutes(schedule.end_time!);
                    if (shiftEndMin <= shiftStartMin) shiftEndMin += 1440;

                    let normApptMinutes = apptMinutes;
                    if (normApptMinutes < shiftStartMin && shiftEndMin > 1440) {
                        normApptMinutes += 1440;
                    }

                    // 1-hour slot boundaries anchored to shift start
                    const slotOffset = Math.floor(Math.max(0, normApptMinutes - shiftStartMin) / 60) * 60;
                    const blockStartMinutes = shiftStartMin + slotOffset;
                    const blockEndMinutes = Math.min(blockStartMinutes + 60, shiftEndMin);
                    const capacityMinutes = blockEndMinutes - blockStartMinutes;

                    const bookedOnDate = await repository.findBookedAppointmentsForDateTx(
                        tx,
                        data.employee_id!,
                        shiftBaseDate
                    );

                    if (shiftEndMin > 1440) {
                        const nextDayAppts = await repository.findBookedAppointmentsForDateTx(
                            tx,
                            data.employee_id!,
                            addDays(shiftBaseDate, 1)
                        );
                        bookedOnDate.push(...nextDayAppts);
                    }

                    const activeAppts = bookedOnDate.filter(
                        (a) => a.status !== "CANCELLED" && a.status !== "NO_SHOW" && a.appointment_time
                    );

                    const isToday = formatDateOnly(shiftBaseDate) === getTodayInIST();
                    const nowMinutes = getNowMinutesInIST();
                    const baselineStart = isToday ? Math.max(blockStartMinutes, nowMinutes) : blockStartMinutes;

                    const priorOrInSlot = activeAppts.filter((a) => {
                        let aStart = timeToMinutes(a.appointment_time!);
                        const isNext = formatDateOnly(a.appointment_date) !== formatDateOnly(shiftBaseDate);
                        if (isNext || (aStart < shiftStartMin && shiftEndMin > 1440)) aStart += 1440;
                        const aEnd = aStart + (a.duration_minutes ?? 10);
                        return aStart < blockEndMinutes && aEnd > blockStartMinutes;
                    });

                    const latestPriorEnd = priorOrInSlot.length > 0
                        ? Math.max(...priorOrInSlot.map((a) => {
                            let aStart = timeToMinutes(a.appointment_time!);
                            const isNext = formatDateOnly(a.appointment_date) !== formatDateOnly(shiftBaseDate);
                            if (isNext || (aStart < shiftStartMin && shiftEndMin > 1440)) aStart += 1440;
                            return aStart + (a.duration_minutes ?? 10);
                        }))
                        : blockStartMinutes;

                    const calculatedStartMinutes = Math.max(baselineStart, latestPriorEnd);

                    if (calculatedStartMinutes >= blockEndMinutes) {
                        throw new Error("This 1-hour session window has no remaining available time slots.");
                    }

                    const subsequentAppts = activeAppts.filter((a) => {
                        let aStart = timeToMinutes(a.appointment_time!);
                        const isNext = formatDateOnly(a.appointment_date) !== formatDateOnly(shiftBaseDate);
                        if (isNext || (aStart < shiftStartMin && shiftEndMin > 1440)) aStart += 1440;
                        return aStart >= calculatedStartMinutes;
                    });

                    const nextBookedStart = subsequentAppts.length > 0
                        ? Math.min(...subsequentAppts.map((a) => {
                            let aStart = timeToMinutes(a.appointment_time!);
                            const isNext = formatDateOnly(a.appointment_date) !== formatDateOnly(shiftBaseDate);
                            if (isNext || (aStart < shiftStartMin && shiftEndMin > 1440)) aStart += 1440;
                            return aStart;
                        }))
                        : shiftEndMin;

                    const contiguousFreeMinutes = Math.max(0, nextBookedStart - calculatedStartMinutes);
                    if (contiguousFreeMinutes < durationMinutes || calculatedStartMinutes + durationMinutes > shiftEndMin) {
                        throw new Error("The requested consultation duration exceeds the available free time in this session.");
                    }

                    // Date Rollover for midnight (> 11:59 PM)
                    const dayOffset = Math.floor(calculatedStartMinutes / 1440);
                    const effectiveAppointmentDate = addDays(shiftBaseDate, dayOffset);
                    const finalAppointmentTime = timeStringToDate(minutesToHHmm(calculatedStartMinutes % 1440));

                    const patientDuplicate =
                        await tx.appointment_history.findFirst(
                            {
                                where: {
                                    patient_id:
                                        data.patient_id,

                                    appointment_date:
                                        effectiveAppointmentDate,

                                    appointment_time:
                                        finalAppointmentTime,

                                    status: {
                                        notIn: [
                                            "CANCELLED",
                                            "NO_SHOW"
                                        ]
                                    }
                                }
                            }
                        );

                    if (patientDuplicate) {
                        throw new Error(
                            "This patient already has an active appointment at the selected date and time"
                        );
                    }

                    const appointmentId =
                        await repository.generateAppointmentNumber(
                            tx
                        );

                    const tokenNumber =
                        await repository.generateTokenNumber(
                            tx,
                            schedule.schedule_id,
                            effectiveAppointmentDate,
                            data.employee_id
                        );

                    const appointment =
                        await repository.createAppointment(
                            tx,
                            {
                                appointment_id:
                                    appointmentId,

                                patient_id:
                                    data.patient_id,

                                employee_id:
                                    data.employee_id,

                                branch_id:
                                    data.branch_id,

                                department_id:
                                    department?.department_id,

                                schedule_id:
                                    schedule.schedule_id,

                                appointment_date:
                                    effectiveAppointmentDate,

                                appointment_time:
                                    finalAppointmentTime,

                                duration_minutes:
                                    durationMinutes,

                                token_number:
                                    tokenNumber,

                                status:
                                    APPOINTMENT_STATUS.SCHEDULED,

                                reason_for_visit:
                                    data.reason_for_visit,

                                referred_by:
                                    data.referred_by,

                                booking_source:
                                    data.booking_source ??
                                    "STAFF",

                                doctor_name:
                                    doctorName,

                                assigned_doctor:
                                    doctorName,

                                department:
                                    department?.department_name,

                                created_by:
                                    createdBy,

                                Patient_type:
                                    data.patient_type,

                                Patient_visit_type:
                                    data.patient_visit_type
                            }
                        );

                    /*
                     * In-app notification for the booked doctor.
                     * Written inside the same transaction so a
                     * booking and its notification succeed or
                     * fail together.
                     */
                    await tx.appointment_notification.create({
                        data: {
                            notification_id: await generateId(
                                tx,
                                "NOTIFICATION"
                            ),
                            appointment_id: appointmentId,
                            channel: "IN_APP",
                            notification_type: "BOOKING",
                            recipient: data.employee_id,
                            status: "UNREAD"
                        }
                    });

                    return {
                        ...appointment,
                        estimated_start_time: formatMinutesTo12Hour(calculatedStartMinutes),
                        estimated_end_time: formatMinutesTo12Hour(calculatedStartMinutes + durationMinutes),
                        slot_window: `${formatMinutesTo12Hour(blockStartMinutes)} - ${formatMinutesTo12Hour(blockEndMinutes)}`
                    };
                }
            )
        );

        const isIpd =
            String(data.reason_for_visit ?? "").trim().toUpperCase().includes("IPD") ||
            String(data.patient_visit_type ?? "").trim().toUpperCase().includes("IPD") ||
            String(data.patient_type ?? "").trim().toUpperCase().includes("IPD");

        if (isIpd && bookedAppointment?.appointment_id) {
            try {
                const ipdService = new IpdService();
                await ipdService.createAdmission(
                    {
                        patient_id: data.patient_id,
                        appointment_id: bookedAppointment.appointment_id,
                        branch_id: data.branch_id,
                        department_id: data.department_id,
                        employee_id: data.employee_id,
                        admission_type: data.patient_type?.toUpperCase() === "DAYCARE" ? "Daycare" : "REGULAR",
                        is_daycare: data.patient_type?.toUpperCase() === "DAYCARE",
                        provisional_diagnosis: data.reason_for_visit || "IPD Admission",
                    },
                    createdBy
                );
            } catch (ipdErr) {
                console.error(
                    `[Appointment IPD Fast-Path] Failed to auto-create admission for appointment ${bookedAppointment.appointment_id}:`,
                    ipdErr
                );
            }
        }

        return bookedAppointment;
    }

    /**
     * Transform Prisma capital-P fields to snake_case for frontend API.
     */
    private transformAppointmentFields(appointment: any): any {
        if (!appointment) return appointment;
        return {
            ...appointment,
            patient_type: appointment.Patient_type,
            patient_visit_type: appointment.Patient_visit_type,
        };
    }

    /**
     * Gets appointments.
     */
    async getAppointments(
        query: GetAppointmentsQuery
    ) {
        const result = await repository.getAppointments(query);
        if (result.appointments) {
            result.appointments = result.appointments.map((a: any) => this.transformAppointmentFields(a));
        }
        return result;
    }

    /**
     * Counts distinct patients who booked appointments with a doctor
     * (optionally scoped to one branch).
     */
    async getDistinctPatientCount(
        employeeId: string,
        branchId?: string | null
    ) {

        const employee =
            await repository.findEmployee(employeeId);

        if (!employee) {
            throw new Error(
                "Doctor not found"
            );
        }

        const totalPatients =
            await repository.countDistinctPatientsForEmployee(
                employeeId,
                branchId
            );

        return {
            employeeId,
            branchId: branchId ?? null,
            totalPatients
        };
    }

    /**
     * Gets an appointment by appointment number.
     */
    async getAppointmentByNumber(
        appointmentNo: string
    ) {

        const appointment =
            await repository.getAppointmentByNumber(
                appointmentNo
            );

        if (!appointment) {
            throw new Error(
                "Appointment not found"
            );
        }

        return this.transformAppointmentFields(appointment);
    }

    /**
     * Updates/reschedules an appointment.
     */
    async updateAppointment(
        appointmentNo: string,
        data: UpdateAppointmentDTO,
        actingUserId: string = "SYSTEM"
    ) {

        const existing =
            await repository.getAppointmentByNumber(
                appointmentNo
            );

        if (!existing) {
            throw new Error(
                "Appointment not found"
            );
        }

        if (
            TERMINAL_APPOINTMENT_STATUSES.includes(
                existing.status ?? ""
            )
        ) {
            throw new Error(
                `Cannot modify an appointment that is already ${existing.status}`
            );
        }

        if (
            existing.status ===
            APPOINTMENT_STATUS.RESCHEDULE_REQUIRED &&
            !data.employee_id
        ) {
            throw new Error(
                "This appointment needs a doctor - select one to resolve the reschedule"
            );
        }

        const employeeId =
            data.employee_id ??
            existing.employee_id!;

        const branchId =
            data.branch_id ??
            existing.branch_id!;

        const departmentId =
            data.department_id ??
            existing.department_id ??
            undefined;

        const appointmentDate =
            data.appointment_date
                ? parseDateOnly(
                    data.appointment_date
                )
                : existing.appointment_date;

        // Moving an appointment to a past day is never valid (leaving the
        // original date untouched is fine, e.g. editing notes or status).
        // Past-ness is judged in the branch's own timezone.
        if (
            data.appointment_date &&
            formatDateOnly(appointmentDate) !==
            formatDateOnly(existing.appointment_date) &&
            formatDateOnly(appointmentDate) < getTodayIn(await getBranchTimezone(branchId))
        ) {
            throw new Error(
                "Appointments cannot be moved to a past date"
            );
        }

        const appointmentTimeStr =
            data.appointment_time ??
            formatTimeOfDay(
                existing.appointment_time
            );

        const scheduleChanged =
            !!data.employee_id ||
            !!data.branch_id ||
            !!data.appointment_date ||
            !!data.appointment_time;

        // A daycare booking's slot was capacity-checked against its ward
        // together with the daycare request -- moving it would bypass that.
        if (scheduleChanged) {
            const daycare =
                await new IpdService().findPlannedDaycareForAppointment(
                    appointmentNo
                );

            if (daycare) {
                throw new Error(
                    `This appointment belongs to daycare booking ${daycare.ip_number} -- cancel it and book the daycare again to change the date, time or doctor`
                );
            }
        }

        return prisma.$transaction(
            async (tx) => {

                let scheduleId =
                    existing.schedule_id!;

                let tokenNumber =
                    existing.token_number;

                let doctorName =
                    existing.doctor_name;

                let departmentName =
                    existing.department;

                if (scheduleChanged) {

                    const {
                        employee,
                        department,
                        schedules
                    } =
                        await this.validateBookingContext(
                            employeeId,
                            branchId,
                            departmentId,
                            appointmentDate,
                            data.schedule_id,
                            appointmentTimeStr
                        );

                    const schedule =
                        this.pickScheduleForTime(
                            schedules,
                            appointmentTimeStr
                        );

                    const appointmentTime =
                        timeStringToDate(
                            appointmentTimeStr
                        );

                    const duplicate =
                        await repository.findDuplicateAppointment(
                            employeeId,
                            appointmentDate,
                            appointmentTime,
                            appointmentNo
                        );

                    if (duplicate) {
                        throw new Error(
                            "This doctor already has an appointment at the selected date and time"
                        );
                    }

                    await repository.lockDoctorSchedule(
                        tx,
                        schedule.schedule_id
                    );

                    tokenNumber =
                        await repository.generateTokenNumber(
                            tx,
                            schedule.schedule_id,
                            appointmentDate
                        );

                    scheduleId =
                        schedule.schedule_id;

                    doctorName =
                        `${employee.first_name} ${employee.last_name}`.trim();

                    departmentName =
                        department?.department_name ??
                        null;
                }

                const appointmentTime =
                    timeStringToDate(
                        appointmentTimeStr
                    );

                const updateData:
                    Prisma.appointment_historyUncheckedUpdateInput =
                {
                    appointment_date:
                        appointmentDate,

                    appointment_time:
                        appointmentTime,

                    reason_for_visit:
                        data.reason_for_visit,

                    referred_by:
                        data.referred_by,

                    Patient_type:
                        data.patient_type,

                    Patient_visit_type:
                        data.patient_visit_type
                };

                if (scheduleChanged) {

                    updateData.employee_id =
                        employeeId;

                    updateData.branch_id =
                        branchId;

                    updateData.department_id =
                        departmentId;

                    updateData.schedule_id =
                        scheduleId;

                    updateData.token_number =
                        tokenNumber;

                    updateData.doctor_name =
                        doctorName;

                    updateData.department =
                        departmentName;

                    updateData.status =
                        "RESCHEDULED";
                }

                const updated =
                    await repository.updateAppointment(
                        tx,
                        appointmentNo,
                        updateData
                    );

                const openQueues =
                    await repository.findOpenRescheduleQueueEntries(
                        tx,
                        appointmentNo
                    );

                for (
                    const queue
                    of openQueues
                ) {

                    await repository.closeRescheduleQueueEntry(
                        tx,
                        queue.queue_id,
                        actingUserId
                    );
                }

                return this.transformAppointmentFields(updated);
            }
        );
    }

    /**
     * Updates appointment status.
     */
    async updateAppointmentStatus(
        appointmentNo: string,
        status: string,
        cancelReason?: string,
        cancelledBy?: string | null
    ) {

        const existing =
            await repository.getAppointmentByNumber(
                appointmentNo
            );

        if (!existing) {
            throw new Error(
                "Appointment not found"
            );
        }

        if (
            TERMINAL_APPOINTMENT_STATUSES.includes(
                existing.status ?? ""
            )
        ) {
            throw new Error(
                `Cannot change status of an appointment that is already ${existing.status}`
            );
        }

        if (
            status ===
            APPOINTMENT_STATUS.CANCELLED &&
            !cancelReason
        ) {
            throw new Error(
                "Cancellation reason is required when cancelling an appointment"
            );
        }

        // Cancelling / no-showing a daycare booking's slot closes the planned
        // daycare request with it (and frees any bed it held), atomically.
        if (
            status === APPOINTMENT_STATUS.CANCELLED ||
            status === APPOINTMENT_STATUS.NO_SHOW
        ) {
            return this.transformAppointmentFields(
                await prisma.$transaction(async (tx) => {

                    const updated =
                        await repository.updateAppointmentStatus(
                            appointmentNo,
                            status,
                            cancelReason,
                            cancelledBy,
                            tx
                        );

                    await new IpdService().closePlannedForAppointment(
                        tx,
                        appointmentNo,
                        status === APPOINTMENT_STATUS.CANCELLED ? "CANCELLED" : "NO_SHOW",
                        cancelReason,
                        cancelledBy || "SYSTEM"
                    );

                    // Recalculate doctor timeline to close the gap and pull subsequent appointments forward
                    if (existing.employee_id && existing.appointment_date) {
                        await this.recalculateDoctorDailyTimeline(
                            tx,
                            existing.employee_id,
                            existing.appointment_date
                        );
                    }

                    return updated;
                })
            );
        }

        return this.transformAppointmentFields(
            await repository.updateAppointmentStatus(
                appointmentNo,
                status,
                cancelReason,
                cancelledBy
            )
        );
    }

    /**
     * Updates doctor clinical chemotherapy fitness status (FIT / UNFIT / PENDING).
     * If UNFIT, records the deferral reason and supportive notes, but preserves
     * the appointment and outpatient consultation visit.
     */
    async updateChemoFitness(
        appointmentNo: string,
        data: UpdateChemoFitnessDTO
    ) {
        const existing = await repository.getAppointmentByNumber(appointmentNo);
        if (!existing) {
            throw new Error("Appointment not found");
        }

        const updateData: any = {
            chemo_fitness: data.fitness,
            chemo_unfit_reason: data.reason || null,
            chemo_unfit_notes: data.notes || null,
            chemo_evaluated_at: new Date(),
            chemo_evaluated_by: data.evaluatedBy || null,
        };

        const updated = await prisma.appointment_history.update({
            where: { appointment_id: appointmentNo },
            data: updateData
        });

        // When marked UNFIT, automatically append clinical deferral documentation
        // into the active encounter notes if one exists.
        if (data.fitness === "UNFIT") {
            const enc = await prisma.encounter.findFirst({
                where: { appointment_id: appointmentNo }
            });
            if (enc) {
                const deferralText = `\n[CHEMOTHERAPY DEFERRED FOR TODAY - UNFIT]\nReason: ${data.reason || "Unspecified"}${data.notes ? `\nNotes: ${data.notes}` : ""}\nPlan: Defer chemo cycle. Conducted OPD consultation and supportive care.\n`;
                await prisma.encounter.update({
                    where: { encounter_no: enc.encounter_no },
                    data: {
                        clinical_notes: enc.clinical_notes ? `${enc.clinical_notes}\n${deferralText}` : deferralText
                    }
                });
            }
        }

        return this.transformAppointmentFields(updated);
    }

    /**
     * Cancels an appointment.
     *
     * There must be only ONE implementation of this method.
     */
    async cancelAppointment(
        appointmentNo: string,
        cancelReason: string,
        cancelledBy?: string | null
    ) {

        return this.updateAppointmentStatus(
            appointmentNo,
            APPOINTMENT_STATUS.CANCELLED,
            cancelReason,
            cancelledBy
        );
    }

    /**
     * Gets available appointment slots.
     *
     * ADD / OVERRIDE / CANCEL are applied before
     * slots are generated.
     */
    async getAvailableSlots(
        employeeId: string,
        branchId: string,
        dateStr: string,
        requestedDurationMinutes?: number
    ) {

        const employee =
            await repository.findEmployee(
                employeeId
            );

        if (!employee) {
            throw new Error(
                "Doctor not found"
            );
        }

        if (
            employee.user_table?.role_type !==
            "DOCTOR"
        ) {
            throw new Error(
                "Selected employee is not a doctor"
            );
        }

        if (
            employee.emp_status !== true
        ) {
            throw new Error(
                "Doctor is inactive. Please contact the administrator."
            );
        }

        const branch =
            await repository.findBranch(
                branchId
            );

        if (!branch) {
            throw new Error(
                "Branch not found"
            );
        }

        if (
            branch.branch_status !==
            "Active"
        ) {
            throw new Error(
                "Selected branch is inactive"
            );
        }

        const mapping =
            await repository.findDoctorBranchMapping(
                employeeId,
                branchId
            );

        if (!mapping) {
            throw new Error(
                "Doctor is not assigned to the selected branch"
            );
        }

        const appointmentDate =
            parseDateOnly(
                dateStr
            );

        /*
         * PENDING/APPROVED leaves wipe the whole day's
         * slot list.
         */
        const blockingLeave =
            await this.getBlockingLeaveForDate(
                employeeId,
                appointmentDate
            );

        if (blockingLeave) {
            return {
                date:
                    dateStr,

                day_of_week:
                    toDayOfWeek(appointmentDate),

                slots: [],

                is_on_leave: true,

                leave_reason:
                    blockingLeave.leave_reason ??
                    null
            };
        }

        const dayOfWeek =
            toDayOfWeek(
                appointmentDate
            );

        const normalSchedules =
            await repository.findActiveDoctorSchedules(
                employeeId,
                branchId,
                dayOfWeek
            );

        const effectiveSchedules =
            await getEffectiveSchedules(
                employeeId,
                branchId,
                appointmentDate,
                normalSchedules
            );

        /**
         * CANCEL or no effective schedule.
         *
         * CANCEL means the entire date has no slots.
         */
        if (
            effectiveSchedules.length === 0
        ) {
            return {
                date:
                    dateStr,

                day_of_week:
                    dayOfWeek,

                slots: []
            };
        }

        const requestedDuration = requestedDurationMinutes && requestedDurationMinutes > 0
            ? requestedDurationMinutes
            : 10;

        const bookedAppointments =
            await repository.findBookedAppointmentsForDate(
                employeeId,
                appointmentDate
            );

        const hasOvernight = effectiveSchedules.some((s) => {
            if (!s.start_time || !s.end_time) return false;
            return timeToMinutes(s.end_time) <= timeToMinutes(s.start_time);
        });

        if (hasOvernight) {
            const nextDayAppts = await repository.findBookedAppointmentsForDate(
                employeeId,
                addDays(appointmentDate, 1)
            );
            bookedAppointments.push(...nextDayAppts);
        }

        // "Today" and "now" are the BRANCH's own time (branch.timezone) -
        // independent of the server's and the browser's timezone.
        const branchTz = await getBranchTimezone(branchId);
        const isToday =
            formatDateOnly(appointmentDate) ===
            getTodayIn(branchTz);

        const nowMinutes =
            getNowMinutesIn(branchTz);

        const allPhases: any[] = [];
        let globalPhaseCounter = 1;

        const activeAppts = bookedAppointments.filter(
            (a) => a.status !== "CANCELLED" && a.status !== "NO_SHOW" && a.appointment_time
        );

        const slots =
            effectiveSchedules.flatMap(
                (schedule) => {
                    if (
                        !schedule.start_time ||
                        !schedule.end_time
                    ) {
                        return [];
                    }

                    const startMinutes = timeToMinutes(schedule.start_time);
                    let endMinutes = timeToMinutes(schedule.end_time);
                    if (endMinutes <= startMinutes) {
                        endMinutes += 1440;
                    }

                    const shiftSlots: any[] = [];
                    const SLOT_DURATION = 60; // 1-Hour Default Sessions

                    for (let pStart = startMinutes; pStart < endMinutes; pStart += SLOT_DURATION) {
                        const pEnd = Math.min(pStart + SLOT_DURATION, endMinutes);
                        const capacityMinutes = pEnd - pStart;

                        const isPast = isToday && (pEnd <= nowMinutes);
                        const baselineStart = isToday ? Math.max(pStart, nowMinutes) : pStart;

                        // Appointments overlapping or prior in this shift
                        const priorOrInSlot = activeAppts.filter((a) => {
                            let m = timeToMinutes(a.appointment_time!);
                            const isNext = formatDateOnly(a.appointment_date) !== formatDateOnly(appointmentDate);
                            if (isNext || (m < startMinutes && endMinutes > 1440)) m += 1440;
                            const aEnd = m + (a.duration_minutes ?? 10);
                            return m < pEnd && aEnd > pStart;
                        });

                        const latestPriorEnd = priorOrInSlot.length > 0
                            ? Math.max(...priorOrInSlot.map((a) => {
                                let m = timeToMinutes(a.appointment_time!);
                                const isNext = formatDateOnly(a.appointment_date) !== formatDateOnly(appointmentDate);
                                if (isNext || (m < startMinutes && endMinutes > 1440)) m += 1440;
                                return m + (a.duration_minutes ?? 10);
                            }))
                            : pStart;

                        const candidateStart = Math.max(baselineStart, latestPriorEnd);

                        // Find subsequent booked appointment starting at or after candidateStart
                        const subsequentAppts = activeAppts.filter((a) => {
                            let m = timeToMinutes(a.appointment_time!);
                            const isNext = formatDateOnly(a.appointment_date) !== formatDateOnly(appointmentDate);
                            if (isNext || (m < startMinutes && endMinutes > 1440)) m += 1440;
                            return m >= candidateStart;
                        });

                        const nextBookedStart = subsequentAppts.length > 0
                            ? Math.min(...subsequentAppts.map((a) => {
                                let m = timeToMinutes(a.appointment_time!);
                                const isNext = formatDateOnly(a.appointment_date) !== formatDateOnly(appointmentDate);
                                if (isNext || (m < startMinutes && endMinutes > 1440)) m += 1440;
                                return m;
                            }))
                            : endMinutes;

                        // Contiguous free space starting from candidateStart (including spilling if next slot is empty)
                        const contiguousFreeMinutes = Math.max(0, nextBookedStart - candidateStart);
                        const hasSufficientSpace = contiguousFreeMinutes >= requestedDuration && (candidateStart + requestedDuration <= endMinutes);

                        const isCompleted = isPast || (candidateStart >= pEnd) || !hasSufficientSpace;
                        const isAvailable = !isCompleted;

                        const normStart = pStart % 1440;
                        const normEnd = pEnd % 1440;
                        const startH = Math.floor(normStart / 60);
                        const startM = normStart % 60;
                        const endH = Math.floor(normEnd / 60);
                        const endM = normEnd % 60;

                        const timeStr = `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;
                        const endTimeStr = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

                        const displayStart = (isToday && isAvailable) ? Math.max(normStart, candidateStart % 1440) : normStart;

                        const dateOffset = Math.floor(pStart / 1440);
                        const slotDate = formatDateOnly(addDays(appointmentDate, dateOffset));
                        const isNextDay = dateOffset > 0;

                        const label = `${formatMinutesTo12Hour(displayStart)} - ${formatMinutesTo12Hour(normEnd)}${isNextDay ? " (+1 day)" : ""}`;
                        const estimatedStartLabel = formatMinutesTo12Hour(candidateStart % 1440);

                        const phaseNumber = globalPhaseCounter++;

                        shiftSlots.push({
                            schedule_id: schedule.schedule_id,
                            shift_name: schedule.shift_name,
                            time: timeStr,
                            end_time: endTimeStr,
                            slot_date: slotDate,
                            is_next_day: isNextDay,
                            label,
                            total_minutes: capacityMinutes,
                            remaining_minutes: contiguousFreeMinutes,
                            estimated_start_time: estimatedStartLabel,
                            available_from: estimatedStartLabel,
                            is_past: isPast,
                            is_available: isAvailable,
                            phase_number: phaseNumber,
                            phase_label: `1-Hour Window (${label})`,
                            is_completed: isCompleted,
                            is_open: isAvailable,
                            is_phase_open: isAvailable,
                            status: isCompleted ? "COMPLETED" : "ACTIVE"
                        });
                    }

                    allPhases.push(...shiftSlots);
                    return shiftSlots;
                }
            );

        const activePhaseObj = allPhases.find(p => p.is_available) || allPhases[0];

        return {
            date:
                dateStr,

            day_of_week:
                dayOfWeek,

            phases: allPhases,
            active_phase_number: activePhaseObj?.phase_number ?? 1,
            slots
        };
    }

    /**
     * Gets daily doctor slot capacity.
     *
     * This version also detects branches that have
     * ADD / OVERRIDE changes even when there is no
     * normal schedule on that weekday.
     */
    async getDoctorSlotSummary(
        employeeId: string,
        dateStr: string
    ) {

        const employee =
            await repository.findEmployee(
                employeeId
            );

        if (!employee) {
            throw new Error(
                "Doctor not found"
            );
        }

        if (
            employee.emp_status !== true
        ) {
            throw new Error(
                "Doctor is inactive. Please contact the administrator."
            );
        }

        const appointmentDate =
            parseDateOnly(
                dateStr
            );

        /*
         * PENDING/APPROVED leaves zero out the summary
         * for the whole day.
         */
        const blockingLeave =
            await this.getBlockingLeaveForDate(
                employeeId,
                appointmentDate
            );

        if (blockingLeave) {
            return {
                date: dateStr,
                day_of_week:
                    toDayOfWeek(appointmentDate),
                total_slots: 0,
                booked_count: 0,
                is_on_leave: true
            };
        }

        const dayOfWeek =
            toDayOfWeek(
                appointmentDate
            );

        /**
         * Find branches from normal schedules.
         */
        const normalBranchRecords =
            await prisma.doctor_schedule.findMany({
                where: {
                    employee_id:
                        employeeId,

                    is_active:
                        true
                },

                select: {
                    branch_id:
                        true
                },

                distinct: [
                    "branch_id"
                ]
            });

        /**
         * Find branches from date-specific changes.
         */
        const changeBranchRecords =
            await prisma.doctor_schedule_change.findMany({
                where: {
                    employee_id:
                        employeeId,

                    change_date:
                        appointmentDate,

                    is_active:
                        true
                },

                select: {
                    branch_id:
                        true
                },

                distinct: [
                    "branch_id"
                ]
            });

        /**
         * Merge branch IDs.
         */
        const branchIds =
            new Set<string>();

        for (
            const record
            of normalBranchRecords
        ) {
            if (record.branch_id) {
                branchIds.add(
                    record.branch_id
                );
            }
        }

        for (
            const record
            of changeBranchRecords
        ) {
            if (record.branch_id) {
                branchIds.add(
                    record.branch_id
                );
            }
        }

        let totalSlots = 0;

        for (
            const branchId
            of branchIds
        ) {

            const normalSchedules =
                await repository.findActiveDoctorSchedules(
                    employeeId,
                    branchId,
                    dayOfWeek
                );

            const effectiveSchedules =
                await getEffectiveSchedules(
                    employeeId,
                    branchId,
                    appointmentDate,
                    normalSchedules
                );

            totalSlots +=
                effectiveSchedules.reduce(
                    (
                        sum,
                        schedule
                    ) => {

                        return (
                            sum +
                            generateTimeSlots(
                                schedule.start_time,
                                schedule.end_time,
                                SLOT_DURATION_MINUTES
                            ).length
                        );
                    },
                    0
                );
        }

        const bookedCount =
            await repository.countBookedAppointmentsForEmployee(
                employeeId,
                appointmentDate
            );

        const percentage =
            totalSlots > 0
                ? Math.min(
                    100,
                    Math.round(
                        (
                            bookedCount /
                            totalSlots
                        ) *
                        100
                    )
                )
                : 0;

        return {
            date:
                dateStr,

            day_of_week:
                dayOfWeek,

            total_slots:
                totalSlots,

            booked_count:
                bookedCount,

            percentage
        };
    }

    /**
     * Gets weekly doctor slot capacity.
     *
     * Each day is processed independently.
     *
     * Branches are discovered from BOTH:
     *
     * 1. doctor_schedule
     * 2. doctor_schedule_change
     *
     * This allows ADD/OVERRIDE-only dates to contribute
     * to the weekly capacity.
     */
    async getDoctorWeekSlotSummary(
        employeeId: string,
        dateStr: string
    ) {

        const employee =
            await repository.findEmployee(
                employeeId
            );

        if (!employee) {
            throw new Error(
                "Doctor not found"
            );
        }

        if (
            employee.emp_status !== true
        ) {
            throw new Error(
                "Doctor is inactive. Please contact the administrator."
            );
        }

        const anchorDate =
            parseDateOnly(
                dateStr
            );

        const {
            start,
            end
        } =
            getWeekRange(
                anchorDate
            );

        /**
         * PENDING/APPROVED leaves overlapping the week
         * zero out the affected days.
         */
        const blockingLeaves =
            await prisma.doctor_leave.findMany({
                where: {
                    employee_id:
                        employeeId,

                    status: {
                        in: [
                            LEAVE_STATUS.PENDING,
                            LEAVE_STATUS.APPROVED
                        ]
                    },

                    leave_start_date: {
                        lte: end
                    },

                    leave_end_date: {
                        gte: start
                    }
                }
            });

        const isLeaveDay = (day: Date) =>
            blockingLeaves.some(
                (leave) =>
                    leave.leave_start_date <= day &&
                    leave.leave_end_date >= day
            );

        let totalSlots = 0;

        /**
         * Process Monday through Sunday.
         */
        for (
            let i = 0;
            i < 7;
            i++
        ) {

            const day =
                new Date(start);

            day.setUTCDate(
                start.getUTCDate() + i
            );

            if (isLeaveDay(day)) {
                continue;
            }

            const dayOfWeek =
                toDayOfWeek(
                    day
                );

            /**
             * Normal schedule branches.
             */
            const normalBranchRecords =
                await prisma.doctor_schedule.findMany({
                    where: {
                        employee_id:
                            employeeId,

                        day_of_week:
                            dayOfWeek,

                        is_active:
                            true
                    },

                    select: {
                        branch_id:
                            true
                    },

                    distinct: [
                        "branch_id"
                    ]
                });

            /**
             * Date-specific change branches.
             */
            const changeBranchRecords =
                await prisma.doctor_schedule_change.findMany({
                    where: {
                        employee_id:
                            employeeId,

                        change_date:
                            day,

                        is_active:
                            true
                    },

                    select: {
                        branch_id:
                            true
                    },

                    distinct: [
                        "branch_id"
                    ]
                });

            const branchIds =
                new Set<string>();

            for (
                const record
                of normalBranchRecords
            ) {

                if (record.branch_id) {
                    branchIds.add(
                        record.branch_id
                    );
                }
            }

            for (
                const record
                of changeBranchRecords
            ) {

                if (record.branch_id) {
                    branchIds.add(
                        record.branch_id
                    );
                }
            }

            for (
                const branchId
                of branchIds
            ) {

                const normalSchedules =
                    await repository.findActiveDoctorSchedules(
                        employeeId,
                        branchId,
                        dayOfWeek
                    );

                const effectiveSchedules =
                    await getEffectiveSchedules(
                        employeeId,
                        branchId,
                        day,
                        normalSchedules
                    );

                totalSlots +=
                    effectiveSchedules.reduce(
                        (
                            sum,
                            schedule
                        ) => {

                            return (
                                sum +
                                generateTimeSlots(
                                    schedule.start_time,
                                    schedule.end_time,
                                    SLOT_DURATION_MINUTES
                                ).length
                            );
                        },
                        0
                    );
            }
        }

        const bookedCount =
            await repository.countBookedAppointmentsForEmployeeInRange(
                employeeId,
                start,
                end
            );

        const percentage =
            totalSlots > 0
                ? Math.min(
                    100,
                    Math.round(
                        (
                            bookedCount /
                            totalSlots
                        ) *
                        100
                    )
                )
                : 0;

        return {
            week_start:
                formatDateOnly(
                    start
                ),

            week_end:
                formatDateOnly(
                    end
                ),

            total_slots:
                totalSlots,

            booked_count:
                bookedCount,

            percentage
        };
    }

    /**
     * Recalculates the continuous timeline for active appointments for a doctor on a specific date.
     * When an appointment is cancelled or marked NO_SHOW, this closes the gap so subsequent
     * appointments move forward while preserving each patient's full duration timeframe.
     */
    async recalculateDoctorDailyTimeline(
        tx: Prisma.TransactionClient,
        employeeId: string,
        appointmentDate: Date
    ) {
        const isToday = formatDateOnly(appointmentDate) === getTodayInIST();
        const nowMinutes = getNowMinutesInIST();

        const allDayAppts = await tx.appointment_history.findMany({
            where: {
                employee_id: employeeId,
                appointment_date: appointmentDate,
            },
            orderBy: {
                appointment_time: "asc"
            }
        });

        const activeAppts = allDayAppts.filter(
            a => a.status !== "CANCELLED" && a.status !== "NO_SHOW"
        );

        if (activeAppts.length === 0) return;

        const apptsBySchedule = new Map<string, typeof activeAppts>();
        for (const appt of activeAppts) {
            const key = appt.schedule_id ? String(appt.schedule_id) : "default";
            if (!apptsBySchedule.has(key)) {
                apptsBySchedule.set(key, []);
            }
            apptsBySchedule.get(key)!.push(appt);
        }

        for (const [scheduleId, appts] of apptsBySchedule.entries()) {
            const scheduleAllAppts = allDayAppts.filter(
                a => (a.schedule_id ? String(a.schedule_id) : "default") === scheduleId
            );

            let queueStartMin = 10 * 60;
            if (scheduleAllAppts.length > 0 && scheduleAllAppts[0].appointment_time) {
                queueStartMin = timeToMinutes(scheduleAllAppts[0].appointment_time);
            } else if (scheduleId !== "default") {
                const schedule = await tx.doctor_schedule.findUnique({
                    where: { schedule_id: BigInt(scheduleId) }
                });
                if (schedule?.start_time) {
                    queueStartMin = timeToMinutes(schedule.start_time);
                }
            } else if (appts.length > 0 && appts[0].appointment_time) {
                queueStartMin = timeToMinutes(appts[0].appointment_time);
            }

            let currentMinutes = queueStartMin;

            for (const appt of appts) {
                if (!appt.appointment_time) continue;
                const dur = appt.duration_minutes ?? 10;
                const currentApptMin = timeToMinutes(appt.appointment_time);

                if (
                    appt.status === APPOINTMENT_STATUS.COMPLETED ||
                    appt.status === APPOINTMENT_STATUS.IN_CONSULTATION
                ) {
                    currentMinutes = Math.max(currentMinutes, currentApptMin + dur);
                    continue;
                }

                let targetStartMin = currentMinutes;
                if (isToday) {
                    targetStartMin = Math.max(targetStartMin, nowMinutes);
                }
                const newStartMin = targetStartMin;
                if (newStartMin !== currentApptMin) {
                    const newTimeDate = timeStringToDate(minutesToHHmm(newStartMin % 1440));
                    await tx.appointment_history.update({
                        where: { appointment_id: appt.appointment_id },
                        data: { appointment_time: newTimeDate }
                    });

                    const shiftDiff = Math.abs(newStartMin - currentApptMin);
                    if (shiftDiff >= 30 && appt.employee_id) {
                        await tx.appointment_notification.create({
                            data: {
                                notification_id: await generateId(tx, "NOTIFICATION"),
                                appointment_id: appt.appointment_id,
                                channel: "IN_APP",
                                notification_type: "SCHEDULE_SHIFT",
                                recipient: appt.employee_id,
                                status: "UNREAD"
                            }
                        }).catch(() => {});
                    }
                }

                currentMinutes = newStartMin + dur;
            }
        }
    }

    /**
     * Sandwiches a patient (e.g. late arrival or returning NO_SHOW / CANCELLED patient)
     * flexibly into the active doctor queue for today / future date.
     * Can be inserted "NEXT_IN_LINE" (right after current consultation/completed)
     * or after a specific selected appointment.
     * Subsequent appointments dynamically shift downstream without modifying any patient's token number.
     */
    async sandwichAppointment(
        appointmentNo: string,
        insertAfterAppointmentNo?: string | null
    ) {
        return prisma.$transaction(async (tx) => {
            const sandwiched = await tx.appointment_history.findUnique({
                where: { appointment_id: appointmentNo },
                include: {
                    patient_bio_data: true,
                    employees: true,
                    doctor_schedule: true
                }
            });

            if (!sandwiched) {
                throw new Error("Appointment not found");
            }

            if (sandwiched.status === APPOINTMENT_STATUS.COMPLETED) {
                throw new Error("Cannot sandwich a completed appointment");
            }

            if (!sandwiched.employee_id || !sandwiched.appointment_date) {
                throw new Error("Appointment does not have an assigned doctor or date");
            }

            const activeAppts = await tx.appointment_history.findMany({
                where: {
                    employee_id: sandwiched.employee_id,
                    appointment_date: sandwiched.appointment_date,
                    appointment_id: { not: appointmentNo },
                    status: { notIn: ["CANCELLED", "NO_SHOW"] }
                },
                orderBy: {
                    appointment_time: "asc"
                }
            });

            const isToday = formatDateOnly(sandwiched.appointment_date) === getTodayInIST();
            const nowMinutes = getNowMinutesInIST();

        const allDayAppts = await tx.appointment_history.findMany({
                where: {
                    employee_id: sandwiched.employee_id,
                    appointment_date: sandwiched.appointment_date
                },
                orderBy: { appointment_time: "asc" }
            });

            let shiftStartMin = 10 * 60;
            if (sandwiched.schedule_id) {
                const sched = await tx.doctor_schedule.findUnique({
                    where: { schedule_id: sandwiched.schedule_id }
                });
                if (sched?.start_time) {
                    shiftStartMin = timeToMinutes(sched.start_time);
                }
            } else if (activeAppts.length > 0 && activeAppts[0].appointment_time) {
                shiftStartMin = Math.floor(timeToMinutes(activeAppts[0].appointment_time) / 60) * 60;
            }
            if (allDayAppts.length > 0 && allDayAppts[0].appointment_time) {
                shiftStartMin = Math.min(shiftStartMin, timeToMinutes(allDayAppts[0].appointment_time));
            }

            const newQueue: any[] = [...activeAppts];
            const dur = sandwiched.duration_minutes ?? 10;

            if (insertAfterAppointmentNo && insertAfterAppointmentNo !== "NEXT_IN_LINE") {
                const targetIdx = newQueue.findIndex(a => a.appointment_id === insertAfterAppointmentNo);
                if (targetIdx !== -1) {
                    newQueue.splice(targetIdx + 1, 0, sandwiched);
                } else {
                    newQueue.push(sandwiched);
                }
            } else {
                let insertIdx = 0;
                for (let i = 0; i < newQueue.length; i++) {
                    const st = newQueue[i].status;
                    if (st === APPOINTMENT_STATUS.COMPLETED || st === APPOINTMENT_STATUS.IN_CONSULTATION) {
                        insertIdx = i + 1;
                    }
                }
                newQueue.splice(insertIdx, 0, sandwiched);
            }

            let currentMinutes = shiftStartMin;
            const updatedQueueSummary: any[] = [];

            for (const appt of newQueue) {
                const apptDur = appt.duration_minutes ?? 10;
                const isTarget = appt.appointment_id === appointmentNo;

                if (!isTarget && (appt.status === APPOINTMENT_STATUS.COMPLETED || appt.status === APPOINTMENT_STATUS.IN_CONSULTATION)) {
                    if (appt.appointment_time) {
                        const existingStart = timeToMinutes(appt.appointment_time);
                        currentMinutes = Math.max(currentMinutes, existingStart + apptDur);
                    }
                    continue;
                }

                let targetStartMin = currentMinutes;
                if (isToday) {
                    targetStartMin = Math.max(targetStartMin, nowMinutes);
                }
                const newStartMin = targetStartMin;
                const newTimeDate = timeStringToDate(minutesToHHmm(newStartMin % 1440));

                const updateData: any = {
                    appointment_time: newTimeDate
                };

                if (isTarget) {
                    updateData.status = APPOINTMENT_STATUS.SCHEDULED;
                }

                await tx.appointment_history.update({
                    where: { appointment_id: appt.appointment_id },
                    data: updateData
                });

                updatedQueueSummary.push({
                    appointment_id: appt.appointment_id,
                    token_number: appt.token_number,
                    start_time: minutesToHHmm(newStartMin % 1440),
                    duration_minutes: apptDur,
                    status: updateData.status || appt.status
                });

                currentMinutes = newStartMin + apptDur;
            }

            return {
                sandwichedAppointmentId: appointmentNo,
                queue: updatedQueueSummary
            };
        });
    }
}