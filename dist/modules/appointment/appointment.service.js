"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const appointment_repository_1 = require("./appointment.repository");
const appointment_constants_1 = require("./appointment.constants");
const appointment_utils_1 = require("./appointment.utils");
const idGenerator_1 = require("../../utils/idGenerator");
const doctorLeave_constants_1 = require("../doctorLeave/doctorLeave.constants");
const repository = new appointment_repository_1.AppointmentRepository();
/**
 * Fixed slot length used for doctor capacity summaries.
 */
const SLOT_DURATION_MINUTES = 20;
/**
 * Converts PostgreSQL TIME represented as Date into minutes.
 */
function dateToMinutes(value) {
    return (value.getUTCHours() * 60 +
        value.getUTCMinutes());
}
/**
 * Converts minutes since midnight into a Date
 * suitable for @db.Time.
 */
function minutesToTimeDate(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const result = new Date(0);
    result.setUTCHours(hours, mins, 0, 0);
    return result;
}
/**
 * Checks whether two time ranges overlap.
 */
function rangesOverlap(start1, end1, start2, end2) {
    return (start1 < end2 &&
        end1 > start2);
}
/**
 * Returns active schedule changes for a doctor,
 * branch and exact date.
 */
async function getScheduleChanges(employeeId, branchId, date) {
    return prisma_1.default.doctor_schedule_change.findMany({
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
async function findReferenceSchedule(employeeId, branchId) {
    const schedule = await prisma_1.default.doctor_schedule.findFirst({
        where: {
            employee_id: employeeId,
            branch_id: branchId,
            is_active: true
        },
        orderBy: {
            start_time: "asc"
        }
    });
    return schedule;
}
/**
 * Converts normal weekly schedules into
 * EffectiveSchedule format.
 */
function convertNormalSchedules(schedules) {
    return schedules
        .filter((schedule) => schedule.start_time &&
        schedule.end_time)
        .map((schedule) => ({
        schedule_id: schedule.schedule_id,
        shift_name: schedule.shift_name ??
            "NORMAL",
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        consultation_minutes: schedule.consultation_minutes ??
            20
    }));
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
async function getEffectiveSchedules(employeeId, branchId, appointmentDate, normalSchedules) {
    const changes = await getScheduleChanges(employeeId, branchId, appointmentDate);
    /**
     * No date-specific changes.
     *
     * Use the normal weekly schedule.
     */
    if (changes.length === 0) {
        return convertNormalSchedules(normalSchedules);
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
    const hasCancel = changes.some((change) => change.mode === "CANCEL");
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
    let referenceSchedule = normalSchedules.find((schedule) => schedule.start_time &&
        schedule.end_time) ?? null;
    if (!referenceSchedule) {
        referenceSchedule =
            await findReferenceSchedule(employeeId, branchId);
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
    const consultationMinutes = referenceSchedule.consultation_minutes ??
        20;
    /**
     * OVERRIDE changes.
     */
    const overrideChanges = changes.filter((change) => change.mode === "OVERRIDE" &&
        change.start_time &&
        change.end_time);
    /**
     * ADD changes.
     */
    const addChanges = changes.filter((change) => change.mode === "ADD" &&
        change.start_time &&
        change.end_time);
    let effectiveSchedules;
    /**
     * OVERRIDE replaces the normal schedule.
     *
     * This also works when normalSchedules is empty.
     */
    if (overrideChanges.length > 0) {
        effectiveSchedules =
            overrideChanges
                .map((change) => {
                if (!change.start_time ||
                    !change.end_time) {
                    return null;
                }
                const startMinutes = dateToMinutes(change.start_time);
                const endMinutes = dateToMinutes(change.end_time);
                if (endMinutes <=
                    startMinutes) {
                    return null;
                }
                return {
                    schedule_id: referenceSchedule.schedule_id,
                    shift_name: "OVERRIDE",
                    start_time: change.start_time,
                    end_time: change.end_time,
                    consultation_minutes: consultationMinutes
                };
            })
                .filter((schedule) => schedule !== null);
    }
    else {
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
            convertNormalSchedules(normalSchedules);
    }
    /**
     * ADD appends additional working time.
     *
     * ADD can work even if there is no normal
     * schedule on that particular weekday.
     */
    for (const change of addChanges) {
        if (!change.start_time ||
            !change.end_time) {
            continue;
        }
        const startMinutes = dateToMinutes(change.start_time);
        const endMinutes = dateToMinutes(change.end_time);
        /**
         * Ignore invalid ranges.
         */
        if (endMinutes <=
            startMinutes) {
            continue;
        }
        /**
         * Prevent overlapping ADD/OVERRIDE ranges
         * from generating duplicate slots.
         */
        const alreadyCovered = effectiveSchedules.some((schedule) => rangesOverlap(startMinutes, endMinutes, dateToMinutes(schedule.start_time), dateToMinutes(schedule.end_time)));
        if (alreadyCovered) {
            continue;
        }
        effectiveSchedules.push({
            schedule_id: referenceSchedule.schedule_id,
            shift_name: "ADD",
            start_time: change.start_time,
            end_time: change.end_time,
            consultation_minutes: consultationMinutes
        });
    }
    /**
     * Sort schedules chronologically.
     */
    effectiveSchedules.sort((a, b) => dateToMinutes(a.start_time) -
        dateToMinutes(b.start_time));
    return effectiveSchedules;
}
class AppointmentService {
    /**
     * Validates doctor, branch, department and
     * effective schedule.
     */
    /*
     * PENDING or APPROVED leave covering the given date.
     * Both block new bookings; REJECTED leaves never do.
     */
    async getBlockingLeaveForDate(employeeId, date) {
        return prisma_1.default.doctor_leave.findFirst({
            where: {
                employee_id: employeeId,
                status: {
                    in: [
                        doctorLeave_constants_1.LEAVE_STATUS.PENDING,
                        doctorLeave_constants_1.LEAVE_STATUS.APPROVED
                    ]
                },
                leave_start_date: { lte: date },
                leave_end_date: { gte: date }
            }
        });
    }
    async validateBookingContext(employeeId, branchId, departmentId, appointmentDate) {
        const employee = await repository.findEmployee(employeeId);
        if (!employee) {
            throw new Error("Doctor not found");
        }
        if (employee.user_table?.role_type !==
            "DOCTOR") {
            throw new Error("Selected employee is not a doctor");
        }
        if (employee.emp_status !== true) {
            throw new Error("Doctor is inactive. Please contact the administrator.");
        }
        const branch = await repository.findBranch(branchId);
        if (!branch) {
            throw new Error("Branch not found");
        }
        if (branch.branch_status !==
            "Active") {
            throw new Error("Selected branch is inactive");
        }
        const mapping = await repository.findDoctorBranchMapping(employeeId, branchId);
        if (!mapping) {
            throw new Error("Doctor is not assigned to the selected branch");
        }
        let department = null;
        if (departmentId) {
            department =
                await repository.findDepartment(departmentId);
            if (!department) {
                throw new Error("Department not found");
            }
        }
        /*
         * PENDING/APPROVED leaves block booking for the
         * whole date range they cover.
         */
        const blockingLeave = await this.getBlockingLeaveForDate(employeeId, appointmentDate);
        if (blockingLeave) {
            throw new Error("Doctor is on leave on the selected date");
        }
        const dayOfWeek = (0, appointment_utils_1.toDayOfWeek)(appointmentDate);
        const normalSchedules = await repository.findActiveDoctorSchedules(employeeId, branchId, dayOfWeek);
        const schedules = await getEffectiveSchedules(employeeId, branchId, appointmentDate, normalSchedules);
        if (schedules.length === 0) {
            const changes = await getScheduleChanges(employeeId, branchId, appointmentDate);
            const hasCancel = changes.some((change) => change.mode ===
                "CANCEL");
            if (hasCancel) {
                throw new Error("Doctor is unavailable on the selected date");
            }
            throw new Error(`Doctor has no active schedule at this branch on ${dayOfWeek}`);
        }
        /**
         * Convert effective schedules into the
         * shape expected by the existing booking logic.
         */
        const convertedSchedules = schedules.map((schedule) => ({
            ...schedule,
            consultation_minutes: schedule.consultation_minutes
        }));
        return {
            employee,
            branch,
            department,
            schedules: convertedSchedules
        };
    }
    /**
     * Finds the effective schedule containing
     * the requested appointment time.
     */
    pickScheduleForTime(schedules, appointmentTime) {
        const requestedMinutes = (0, appointment_utils_1.timeToMinutes)((0, appointment_utils_1.timeStringToDate)(appointmentTime));
        const match = schedules.find((schedule) => {
            if (!schedule.start_time ||
                !schedule.end_time) {
                return false;
            }
            const startMinutes = (0, appointment_utils_1.timeToMinutes)(schedule.start_time);
            const endMinutes = (0, appointment_utils_1.timeToMinutes)(schedule.end_time);
            return (requestedMinutes >=
                startMinutes &&
                requestedMinutes <
                    endMinutes);
        });
        if (!match) {
            throw new Error("Selected time is outside the doctor's working hours");
        }
        return match;
    }
    /**
     * Creates an appointment.
     */
    async bookAppointment(data, createdBy) {
        const patient = await repository.findPatient(data.patient_id);
        if (!patient) {
            throw new Error("Patient not found");
        }
        const appointmentDate = (0, appointment_utils_1.parseDateOnly)(data.appointment_date);
        const { employee, department, schedules } = await this.validateBookingContext(data.employee_id, data.branch_id, data.department_id, appointmentDate);
        /**
         * Validates ADD / OVERRIDE / CANCEL.
         */
        const schedule = this.pickScheduleForTime(schedules, data.appointment_time);
        const appointmentTime = (0, appointment_utils_1.timeStringToDate)(data.appointment_time);
        const duplicate = await repository.findDuplicateAppointment(data.employee_id, appointmentDate, appointmentTime);
        if (duplicate) {
            throw new Error("This doctor already has an appointment at the selected date and time");
        }
        const doctorName = `${employee.first_name} ${employee.last_name}`.trim();
        return prisma_1.default.$transaction(async (tx) => {
            await repository.lockDoctorSchedule(tx, schedule.schedule_id);
            const stillDuplicate = await tx.appointment_history.findFirst({
                where: {
                    employee_id: data.employee_id,
                    appointment_date: appointmentDate,
                    appointment_time: appointmentTime,
                    status: {
                        notIn: [
                            "CANCELLED",
                            "NO_SHOW"
                        ]
                    }
                }
            });
            if (stillDuplicate) {
                throw new Error("This doctor already has an appointment at the selected date and time");
            }
            const appointmentId = await repository.generateAppointmentNumber(tx);
            const tokenNumber = await repository.generateTokenNumber(tx, schedule.schedule_id, appointmentDate);
            const appointment = await repository.createAppointment(tx, {
                appointment_id: appointmentId,
                patient_id: data.patient_id,
                employee_id: data.employee_id,
                branch_id: data.branch_id,
                department_id: department?.department_id,
                schedule_id: schedule.schedule_id,
                appointment_date: appointmentDate,
                appointment_time: appointmentTime,
                token_number: tokenNumber,
                status: appointment_constants_1.APPOINTMENT_STATUS.SCHEDULED,
                reason_for_visit: data.reason_for_visit,
                referred_by: data.referred_by,
                booking_source: data.booking_source ??
                    "STAFF",
                doctor_name: doctorName,
                assigned_doctor: doctorName,
                department: department?.department_name,
                created_by: createdBy
            });
            /*
             * In-app notification for the booked doctor.
             * Written inside the same transaction so a
             * booking and its notification succeed or
             * fail together.
             */
            await tx.appointment_notification.create({
                data: {
                    notification_id: await (0, idGenerator_1.generateId)(tx, "NOTIFICATION"),
                    appointment_id: appointmentId,
                    channel: "IN_APP",
                    notification_type: "BOOKING",
                    recipient: data.employee_id,
                    status: "UNREAD"
                }
            });
            return appointment;
        });
    }
    /**
     * Gets appointments.
     */
    async getAppointments(query) {
        return repository.getAppointments(query);
    }
    /**
     * Gets an appointment by appointment number.
     */
    async getAppointmentByNumber(appointmentNo) {
        const appointment = await repository.getAppointmentByNumber(appointmentNo);
        if (!appointment) {
            throw new Error("Appointment not found");
        }
        return appointment;
    }
    /**
     * Updates/reschedules an appointment.
     */
    async updateAppointment(appointmentNo, data, actingUserId = "SYSTEM") {
        const existing = await repository.getAppointmentByNumber(appointmentNo);
        if (!existing) {
            throw new Error("Appointment not found");
        }
        if (appointment_constants_1.TERMINAL_APPOINTMENT_STATUSES.includes(existing.status ?? "")) {
            throw new Error(`Cannot modify an appointment that is already ${existing.status}`);
        }
        if (existing.status ===
            appointment_constants_1.APPOINTMENT_STATUS.RESCHEDULE_REQUIRED &&
            !data.employee_id) {
            throw new Error("This appointment needs a doctor - select one to resolve the reschedule");
        }
        const employeeId = data.employee_id ??
            existing.employee_id;
        const branchId = data.branch_id ??
            existing.branch_id;
        const departmentId = data.department_id ??
            existing.department_id ??
            undefined;
        const appointmentDate = data.appointment_date
            ? (0, appointment_utils_1.parseDateOnly)(data.appointment_date)
            : existing.appointment_date;
        const appointmentTimeStr = data.appointment_time ??
            (0, appointment_utils_1.formatTimeOfDay)(existing.appointment_time);
        const scheduleChanged = !!data.employee_id ||
            !!data.branch_id ||
            !!data.appointment_date ||
            !!data.appointment_time;
        return prisma_1.default.$transaction(async (tx) => {
            let scheduleId = existing.schedule_id;
            let tokenNumber = existing.token_number;
            let doctorName = existing.doctor_name;
            let departmentName = existing.department;
            if (scheduleChanged) {
                const { employee, department, schedules } = await this.validateBookingContext(employeeId, branchId, departmentId, appointmentDate);
                const schedule = this.pickScheduleForTime(schedules, appointmentTimeStr);
                const appointmentTime = (0, appointment_utils_1.timeStringToDate)(appointmentTimeStr);
                const duplicate = await repository.findDuplicateAppointment(employeeId, appointmentDate, appointmentTime, appointmentNo);
                if (duplicate) {
                    throw new Error("This doctor already has an appointment at the selected date and time");
                }
                await repository.lockDoctorSchedule(tx, schedule.schedule_id);
                tokenNumber =
                    await repository.generateTokenNumber(tx, schedule.schedule_id, appointmentDate);
                scheduleId =
                    schedule.schedule_id;
                doctorName =
                    `${employee.first_name} ${employee.last_name}`.trim();
                departmentName =
                    department?.department_name ??
                        null;
            }
            const appointmentTime = (0, appointment_utils_1.timeStringToDate)(appointmentTimeStr);
            const updateData = {
                appointment_date: appointmentDate,
                appointment_time: appointmentTime,
                reason_for_visit: data.reason_for_visit,
                referred_by: data.referred_by
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
            const updated = await repository.updateAppointment(tx, appointmentNo, updateData);
            const openQueues = await repository.findOpenRescheduleQueueEntries(tx, appointmentNo);
            for (const queue of openQueues) {
                await repository.closeRescheduleQueueEntry(tx, queue.queue_id, actingUserId);
            }
            return updated;
        });
    }
    /**
     * Updates appointment status.
     */
    async updateAppointmentStatus(appointmentNo, status, cancelReason, cancelledBy) {
        const existing = await repository.getAppointmentByNumber(appointmentNo);
        if (!existing) {
            throw new Error("Appointment not found");
        }
        if (appointment_constants_1.TERMINAL_APPOINTMENT_STATUSES.includes(existing.status ?? "")) {
            throw new Error(`Cannot change status of an appointment that is already ${existing.status}`);
        }
        if (status ===
            appointment_constants_1.APPOINTMENT_STATUS.CANCELLED &&
            !cancelReason) {
            throw new Error("Cancellation reason is required when cancelling an appointment");
        }
        /**
         * cancelledBy is accepted here so the controller
         * can pass the authenticated user.
         *
         * The current repository method accepts:
         * appointmentNo, status, cancelReason
         *
         * Therefore cancelledBy is intentionally not passed
         * to the repository until the repository supports
         * that fourth parameter.
         */
        void cancelledBy;
        return repository.updateAppointmentStatus(appointmentNo, status, cancelReason);
    }
    /**
     * Cancels an appointment.
     *
     * There must be only ONE implementation of this method.
     */
    async cancelAppointment(appointmentNo, cancelReason, cancelledBy) {
        return this.updateAppointmentStatus(appointmentNo, appointment_constants_1.APPOINTMENT_STATUS.CANCELLED, cancelReason, cancelledBy);
    }
    /**
     * Gets available appointment slots.
     *
     * ADD / OVERRIDE / CANCEL are applied before
     * slots are generated.
     */
    async getAvailableSlots(employeeId, branchId, dateStr) {
        const employee = await repository.findEmployee(employeeId);
        if (!employee) {
            throw new Error("Doctor not found");
        }
        if (employee.user_table?.role_type !==
            "DOCTOR") {
            throw new Error("Selected employee is not a doctor");
        }
        if (employee.emp_status !== true) {
            throw new Error("Doctor is inactive. Please contact the administrator.");
        }
        const branch = await repository.findBranch(branchId);
        if (!branch) {
            throw new Error("Branch not found");
        }
        if (branch.branch_status !==
            "Active") {
            throw new Error("Selected branch is inactive");
        }
        const mapping = await repository.findDoctorBranchMapping(employeeId, branchId);
        if (!mapping) {
            throw new Error("Doctor is not assigned to the selected branch");
        }
        const appointmentDate = (0, appointment_utils_1.parseDateOnly)(dateStr);
        /*
         * PENDING/APPROVED leaves wipe the whole day's
         * slot list.
         */
        const blockingLeave = await this.getBlockingLeaveForDate(employeeId, appointmentDate);
        if (blockingLeave) {
            return {
                date: dateStr,
                day_of_week: (0, appointment_utils_1.toDayOfWeek)(appointmentDate),
                slots: [],
                is_on_leave: true,
                leave_reason: blockingLeave.leave_reason ??
                    null
            };
        }
        const dayOfWeek = (0, appointment_utils_1.toDayOfWeek)(appointmentDate);
        const normalSchedules = await repository.findActiveDoctorSchedules(employeeId, branchId, dayOfWeek);
        const effectiveSchedules = await getEffectiveSchedules(employeeId, branchId, appointmentDate, normalSchedules);
        /**
         * CANCEL or no effective schedule.
         *
         * CANCEL means the entire date has no slots.
         */
        if (effectiveSchedules.length === 0) {
            return {
                date: dateStr,
                day_of_week: dayOfWeek,
                slots: []
            };
        }
        const bookedTimes = await repository.findBookedAppointmentTimes(employeeId, appointmentDate);
        const bookedSet = new Set(bookedTimes.map(appointment_utils_1.formatTimeOfDay));
        const now = new Date();
        const isToday = appointmentDate.getUTCFullYear() ===
            now.getUTCFullYear() &&
            appointmentDate.getUTCMonth() ===
                now.getUTCMonth() &&
            appointmentDate.getUTCDate() ===
                now.getUTCDate();
        const nowMinutes = now.getHours() * 60 +
            now.getMinutes();
        const slots = effectiveSchedules.flatMap((schedule) => {
            if (!schedule.start_time ||
                !schedule.end_time) {
                return [];
            }
            const times = (0, appointment_utils_1.generateTimeSlots)(schedule.start_time, schedule.end_time, schedule.consultation_minutes ??
                20);
            return times
                .filter((time) => !isToday ||
                (0, appointment_utils_1.timeStringToMinutes)(time) >
                    nowMinutes)
                .map((time) => ({
                schedule_id: schedule.schedule_id,
                shift_name: schedule.shift_name,
                time,
                is_available: !bookedSet.has(time)
            }));
        });
        return {
            date: dateStr,
            day_of_week: dayOfWeek,
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
    async getDoctorSlotSummary(employeeId, dateStr) {
        const employee = await repository.findEmployee(employeeId);
        if (!employee) {
            throw new Error("Doctor not found");
        }
        if (employee.emp_status !== true) {
            throw new Error("Doctor is inactive. Please contact the administrator.");
        }
        const appointmentDate = (0, appointment_utils_1.parseDateOnly)(dateStr);
        /*
         * PENDING/APPROVED leaves zero out the summary
         * for the whole day.
         */
        const blockingLeave = await this.getBlockingLeaveForDate(employeeId, appointmentDate);
        if (blockingLeave) {
            return {
                date: dateStr,
                day_of_week: (0, appointment_utils_1.toDayOfWeek)(appointmentDate),
                total_slots: 0,
                booked_count: 0,
                is_on_leave: true
            };
        }
        const dayOfWeek = (0, appointment_utils_1.toDayOfWeek)(appointmentDate);
        /**
         * Find branches from normal schedules.
         */
        const normalBranchRecords = await prisma_1.default.doctor_schedule.findMany({
            where: {
                employee_id: employeeId,
                is_active: true
            },
            select: {
                branch_id: true
            },
            distinct: [
                "branch_id"
            ]
        });
        /**
         * Find branches from date-specific changes.
         */
        const changeBranchRecords = await prisma_1.default.doctor_schedule_change.findMany({
            where: {
                employee_id: employeeId,
                change_date: appointmentDate,
                is_active: true
            },
            select: {
                branch_id: true
            },
            distinct: [
                "branch_id"
            ]
        });
        /**
         * Merge branch IDs.
         */
        const branchIds = new Set();
        for (const record of normalBranchRecords) {
            if (record.branch_id) {
                branchIds.add(record.branch_id);
            }
        }
        for (const record of changeBranchRecords) {
            if (record.branch_id) {
                branchIds.add(record.branch_id);
            }
        }
        let totalSlots = 0;
        for (const branchId of branchIds) {
            const normalSchedules = await repository.findActiveDoctorSchedules(employeeId, branchId, dayOfWeek);
            const effectiveSchedules = await getEffectiveSchedules(employeeId, branchId, appointmentDate, normalSchedules);
            totalSlots +=
                effectiveSchedules.reduce((sum, schedule) => {
                    return (sum +
                        (0, appointment_utils_1.generateTimeSlots)(schedule.start_time, schedule.end_time, SLOT_DURATION_MINUTES).length);
                }, 0);
        }
        const bookedCount = await repository.countBookedAppointmentsForEmployee(employeeId, appointmentDate);
        const percentage = totalSlots > 0
            ? Math.min(100, Math.round((bookedCount /
                totalSlots) *
                100))
            : 0;
        return {
            date: dateStr,
            day_of_week: dayOfWeek,
            total_slots: totalSlots,
            booked_count: bookedCount,
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
    async getDoctorWeekSlotSummary(employeeId, dateStr) {
        const employee = await repository.findEmployee(employeeId);
        if (!employee) {
            throw new Error("Doctor not found");
        }
        if (employee.emp_status !== true) {
            throw new Error("Doctor is inactive. Please contact the administrator.");
        }
        const anchorDate = (0, appointment_utils_1.parseDateOnly)(dateStr);
        const { start, end } = (0, appointment_utils_1.getWeekRange)(anchorDate);
        /**
         * PENDING/APPROVED leaves overlapping the week
         * zero out the affected days.
         */
        const blockingLeaves = await prisma_1.default.doctor_leave.findMany({
            where: {
                employee_id: employeeId,
                status: {
                    in: [
                        doctorLeave_constants_1.LEAVE_STATUS.PENDING,
                        doctorLeave_constants_1.LEAVE_STATUS.APPROVED
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
        const isLeaveDay = (day) => blockingLeaves.some((leave) => leave.leave_start_date <= day &&
            leave.leave_end_date >= day);
        let totalSlots = 0;
        /**
         * Process Monday through Sunday.
         */
        for (let i = 0; i < 7; i++) {
            const day = new Date(start);
            day.setUTCDate(start.getUTCDate() + i);
            if (isLeaveDay(day)) {
                continue;
            }
            const dayOfWeek = (0, appointment_utils_1.toDayOfWeek)(day);
            /**
             * Normal schedule branches.
             */
            const normalBranchRecords = await prisma_1.default.doctor_schedule.findMany({
                where: {
                    employee_id: employeeId,
                    day_of_week: dayOfWeek,
                    is_active: true
                },
                select: {
                    branch_id: true
                },
                distinct: [
                    "branch_id"
                ]
            });
            /**
             * Date-specific change branches.
             */
            const changeBranchRecords = await prisma_1.default.doctor_schedule_change.findMany({
                where: {
                    employee_id: employeeId,
                    change_date: day,
                    is_active: true
                },
                select: {
                    branch_id: true
                },
                distinct: [
                    "branch_id"
                ]
            });
            const branchIds = new Set();
            for (const record of normalBranchRecords) {
                if (record.branch_id) {
                    branchIds.add(record.branch_id);
                }
            }
            for (const record of changeBranchRecords) {
                if (record.branch_id) {
                    branchIds.add(record.branch_id);
                }
            }
            for (const branchId of branchIds) {
                const normalSchedules = await repository.findActiveDoctorSchedules(employeeId, branchId, dayOfWeek);
                const effectiveSchedules = await getEffectiveSchedules(employeeId, branchId, day, normalSchedules);
                totalSlots +=
                    effectiveSchedules.reduce((sum, schedule) => {
                        return (sum +
                            (0, appointment_utils_1.generateTimeSlots)(schedule.start_time, schedule.end_time, SLOT_DURATION_MINUTES).length);
                    }, 0);
            }
        }
        const bookedCount = await repository.countBookedAppointmentsForEmployeeInRange(employeeId, start, end);
        const percentage = totalSlots > 0
            ? Math.min(100, Math.round((bookedCount /
                totalSlots) *
                100))
            : 0;
        return {
            week_start: (0, appointment_utils_1.formatDateOnly)(start),
            week_end: (0, appointment_utils_1.formatDateOnly)(end),
            total_slots: totalSlots,
            booked_count: bookedCount,
            percentage
        };
    }
}
exports.AppointmentService = AppointmentService;
