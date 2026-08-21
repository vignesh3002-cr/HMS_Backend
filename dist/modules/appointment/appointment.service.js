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
const repository = new appointment_repository_1.AppointmentRepository();
/**
 * Fixed slot length used for doctor capacity summaries.
 */
const SLOT_DURATION_MINUTES = 20;
// =========================================================
// TIME HELPERS
// =========================================================
function dateToMinutes(value) {
    return (value.getUTCHours() * 60 +
        value.getUTCMinutes());
}
function rangesOverlap(start1, end1, start2, end2) {
    return (start1 < end2 &&
        end1 > start2);
}
// =========================================================
// SCHEDULE CHANGE LOOKUP
// =========================================================
/**
 * Gets active date-specific schedule changes.
 *
 * IMPORTANT:
 * The repository uses exact UTC-midnight dates, matching
 * parseDateOnly() used by the schedule-change service.
 */
async function getScheduleChanges(employeeId, branchId, date) {
    return repository.findDoctorScheduleChange(employeeId, branchId, date);
}
// =========================================================
// NORMAL SCHEDULE CONVERSION
// =========================================================
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
// =========================================================
// REFERENCE SCHEDULE SYNTHESIS
// =========================================================
/**
 * Creates an effective schedule from an existing
 * doctor_schedule row.
 *
 * The reference row may be inactive.
 *
 * This is important when a recurring day was toggled OFF
 * and a Week View ADD is then created for that date.
 */
function synthesizeSchedulesFromReference(referenceSchedule) {
    const consultationMinutes = referenceSchedule.consultation_minutes ??
        20;
    if (!referenceSchedule.start_time ||
        !referenceSchedule.end_time) {
        return [];
    }
    return [
        {
            schedule_id: referenceSchedule.schedule_id,
            shift_name: "NORMAL",
            start_time: referenceSchedule.start_time,
            end_time: referenceSchedule.end_time,
            consultation_minutes: consultationMinutes
        }
    ];
}
// =========================================================
// EFFECTIVE SCHEDULE
// =========================================================
/**
 * Applies ADD / OVERRIDE / CANCEL to the normal
 * recurring weekly schedule.
 *
 * Rules:
 *
 * NORMAL
 *   normal weekly schedule
 *
 * ADD
 *   normal + additional range
 *
 * OVERRIDE
 *   override replaces normal
 *
 * CANCEL
 *   entire date cancelled
 *
 * OVERRIDE + ADD
 *   override + additional range
 *
 * CANCEL has absolute priority.
 *
 * IMPORTANT:
 *
 * A date-specific ADD is allowed even when the normal
 * recurring schedule for that weekday is inactive.
 */
async function getEffectiveSchedules(employeeId, branchId, appointmentDate, normalSchedules) {
    const changes = await getScheduleChanges(employeeId, branchId, appointmentDate);
    // =====================================================
    // NO DATE-SPECIFIC CHANGES
    // =====================================================
    if (changes.length === 0) {
        if (normalSchedules.length > 0) {
            return convertNormalSchedules(normalSchedules);
        }
        /**
         * No normal schedule for this weekday.
         *
         * This is simply an OFF day with no ADD/OVERRIDE.
         *
         * There should be no consultation slots.
         */
        return [];
    }
    // =====================================================
    // CANCEL
    // =====================================================
    const hasCancel = changes.some((change) => change.mode === "CANCEL");
    if (hasCancel) {
        return [];
    }
    // =====================================================
    // FIND REFERENCE SCHEDULE
    // =====================================================
    /**
     * First prefer a normal schedule from this weekday.
     */
    let referenceSchedule = normalSchedules.find((schedule) => schedule.start_time &&
        schedule.end_time) ?? null;
    /**
     * If the weekday is OFF, there will be no active
     * schedule in normalSchedules.
     *
     * We therefore search ALL schedules for the doctor
     * + branch, including inactive rows.
     *
     * This is the key fix for:
     *
     * Day OFF
     *   ↓
     * Week View ADD
     *   ↓
     * consultation slots
     */
    if (!referenceSchedule) {
        referenceSchedule =
            await repository.findReferenceSchedule(employeeId, branchId);
    }
    /**
     * A schedule_id is required by appointment_history.
     *
     * If the doctor has never had any schedule at this
     * branch, there is no valid schedule_id to reference.
     */
    if (!referenceSchedule) {
        return [];
    }
    const consultationMinutes = referenceSchedule.consultation_minutes ??
        20;
    // =====================================================
    // OVERRIDE
    // =====================================================
    const overrideChanges = changes.filter((change) => change.mode === "OVERRIDE" &&
        change.start_time &&
        change.end_time);
    // =====================================================
    // ADD
    // =====================================================
    const addChanges = changes.filter((change) => change.mode === "ADD" &&
        change.start_time &&
        change.end_time);
    let effectiveSchedules;
    // =====================================================
    // OVERRIDE REPLACES NORMAL
    // =====================================================
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
                    schedule_id: referenceSchedule
                        .schedule_id,
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
         * Use normal schedule if one exists.
         *
         * If the day is OFF, this is intentionally empty.
         * ADD below will populate it.
         */
        effectiveSchedules =
            convertNormalSchedules(normalSchedules);
    }
    // =====================================================
    // ADD
    // =====================================================
    /**
     * ADD is allowed even when normalSchedules is empty.
     *
     * This is what enables:
     *
     * Day OFF
     *   ↓
     * Week View ADD
     *   ↓
     * ADD effective schedule
     *   ↓
     * consultation slots
     */
    for (const change of addChanges) {
        if (!change.start_time ||
            !change.end_time) {
            continue;
        }
        const startMinutes = dateToMinutes(change.start_time);
        const endMinutes = dateToMinutes(change.end_time);
        if (endMinutes <=
            startMinutes) {
            continue;
        }
        /**
         * Do not generate duplicate slots when the ADD
         * overlaps an already effective range.
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
    // =====================================================
    // SORT
    // =====================================================
    effectiveSchedules.sort((a, b) => dateToMinutes(a.start_time) -
        dateToMinutes(b.start_time));
    return effectiveSchedules;
}
// =========================================================
// APPOINTMENT SERVICE
// =========================================================
class AppointmentService {
    // =====================================================
    // VALIDATE BOOKING CONTEXT
    // =====================================================
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
        const dayOfWeek = (0, appointment_utils_1.toDayOfWeek)(appointmentDate);
        const normalSchedules = await repository.findActiveDoctorSchedules(employeeId, branchId, dayOfWeek);
        const schedules = await getEffectiveSchedules(employeeId, branchId, appointmentDate, normalSchedules);
        // =================================================
        // NO EFFECTIVE SCHEDULE
        // =================================================
        if (schedules.length === 0) {
            const changes = await getScheduleChanges(employeeId, branchId, appointmentDate);
            const hasCancel = changes.some((change) => change.mode ===
                "CANCEL");
            if (hasCancel) {
                throw new Error("Doctor is unavailable on the selected date");
            }
            /**
             * No normal schedule and no ADD/OVERRIDE.
             *
             * Keep the existing off-day booking behavior.
             *
             * Find ANY schedule, including inactive schedules,
             * so appointment_history.schedule_id remains valid.
             */
            const referenceSchedule = await repository.findReferenceSchedule(employeeId, branchId);
            if (!referenceSchedule) {
                throw new Error(`Doctor has no schedule at this branch on ${dayOfWeek}`);
            }
            return {
                employee,
                branch,
                department,
                schedules: [
                    referenceSchedule
                ],
                isOffDayBooking: true
            };
        }
        // =================================================
        // CONVERT EFFECTIVE SCHEDULES
        // =================================================
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
    // =====================================================
    // PICK SCHEDULE FOR TIME
    // =====================================================
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
    // =====================================================
    // BOOK APPOINTMENT
    // =====================================================
    async bookAppointment(data, createdBy) {
        const patient = await repository.findPatient(data.patient_id);
        if (!patient) {
            throw new Error("Patient not found");
        }
        const appointmentDate = (0, appointment_utils_1.parseDateOnly)(data.appointment_date);
        const { employee, department, schedules, isOffDayBooking } = await this.validateBookingContext(data.employee_id, data.branch_id, data.department_id, appointmentDate);
        const schedule = isOffDayBooking
            ? schedules[0]
            : this.pickScheduleForTime(schedules, data.appointment_time);
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
            return repository.createAppointment(tx, {
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
        });
    }
    // =====================================================
    // GET APPOINTMENTS
    // =====================================================
    async getAppointments(query) {
        return repository.getAppointments(query);
    }
    // =====================================================
    // GET APPOINTMENT
    // =====================================================
    async getAppointmentByNumber(appointmentNo) {
        const appointment = await repository.getAppointmentByNumber(appointmentNo);
        if (!appointment) {
            throw new Error("Appointment not found");
        }
        return appointment;
    }
    // =====================================================
    // UPDATE APPOINTMENT
    // =====================================================
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
                const { employee, department, schedules, isOffDayBooking } = await this.validateBookingContext(employeeId, branchId, departmentId, appointmentDate);
                const schedule = isOffDayBooking
                    ? schedules[0]
                    : this.pickScheduleForTime(schedules, appointmentTimeStr);
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
    // =====================================================
    // UPDATE STATUS
    // =====================================================
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
        return repository.updateAppointmentStatus(appointmentNo, status, cancelReason, cancelledBy);
    }
    // =====================================================
    // CANCEL APPOINTMENT
    // =====================================================
    async cancelAppointment(appointmentNo, cancelReason, cancelledBy) {
        return this.updateAppointmentStatus(appointmentNo, appointment_constants_1.APPOINTMENT_STATUS.CANCELLED, cancelReason, cancelledBy);
    }
    // =====================================================
    // AVAILABLE APPOINTMENT SLOTS
    // =====================================================
    async getAvailableSlots(employeeId, branchId, dateStr) {
        // =================================================
        // VALIDATE DOCTOR
        // =================================================
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
        // =================================================
        // VALIDATE BRANCH
        // =================================================
        const branch = await repository.findBranch(branchId);
        if (!branch) {
            throw new Error("Branch not found");
        }
        if (branch.branch_status !==
            "Active") {
            throw new Error("Selected branch is inactive");
        }
        // =================================================
        // VALIDATE MAPPING
        // =================================================
        const mapping = await repository.findDoctorBranchMapping(employeeId, branchId);
        if (!mapping) {
            throw new Error("Doctor is not assigned to the selected branch");
        }
        // =================================================
        // DATE
        // =================================================
        const appointmentDate = (0, appointment_utils_1.parseDateOnly)(dateStr);
        const dayOfWeek = (0, appointment_utils_1.toDayOfWeek)(appointmentDate);
        // =================================================
        // NORMAL SCHEDULE
        // =================================================
        const normalSchedules = await repository.findActiveDoctorSchedules(employeeId, branchId, dayOfWeek);
        // =================================================
        // EFFECTIVE SCHEDULE
        // =================================================
        const effectiveSchedules = await getEffectiveSchedules(employeeId, branchId, appointmentDate, normalSchedules);
        // =================================================
        // CHANGE STATUS
        // =================================================
        const changes = await repository.findDoctorScheduleChange(employeeId, branchId, appointmentDate);
        const isCancelled = changes.some((change) => change.mode === "CANCEL");
        // =================================================
        // NO EFFECTIVE SCHEDULE
        // =================================================
        if (effectiveSchedules.length === 0) {
            return {
                date: dateStr,
                day_of_week: dayOfWeek,
                slots: [],
                is_cancelled: isCancelled
            };
        }
        // =================================================
        // BOOKED TIMES
        // =================================================
        const bookedTimes = await repository.findBookedAppointmentTimes(employeeId, appointmentDate);
        const bookedSet = new Set(bookedTimes.map(appointment_utils_1.formatTimeOfDay));
        // =================================================
        // TODAY CHECK
        // =================================================
        const now = new Date();
        const isToday = appointmentDate.getUTCFullYear() ===
            now.getUTCFullYear() &&
            appointmentDate.getUTCMonth() ===
                now.getUTCMonth() &&
            appointmentDate.getUTCDate() ===
                now.getUTCDate();
        const nowMinutes = now.getHours() * 60 +
            now.getMinutes();
        // =================================================
        // GENERATE CONSULTATION SLOTS
        // =================================================
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
        // =================================================
        // RESPONSE
        // =================================================
        return {
            date: dateStr,
            day_of_week: dayOfWeek,
            slots,
            is_cancelled: isCancelled
        };
    }
    // =====================================================
    // DAILY SLOT SUMMARY
    // =====================================================
    async getDoctorSlotSummary(employeeId, dateStr) {
        const employee = await repository.findEmployee(employeeId);
        if (!employee) {
            throw new Error("Doctor not found");
        }
        if (employee.emp_status !== true) {
            throw new Error("Doctor is inactive. Please contact the administrator.");
        }
        const appointmentDate = (0, appointment_utils_1.parseDateOnly)(dateStr);
        const dayOfWeek = (0, appointment_utils_1.toDayOfWeek)(appointmentDate);
        // =================================================
        // NORMAL SCHEDULE BRANCHES
        // =================================================
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
        // =================================================
        // CHANGE BRANCHES
        // =================================================
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
        // =================================================
        // PROCESS BRANCHES
        // =================================================
        for (const branchId of branchIds) {
            const normalSchedules = await repository.findActiveDoctorSchedules(employeeId, branchId, dayOfWeek);
            const effectiveSchedules = await getEffectiveSchedules(employeeId, branchId, appointmentDate, normalSchedules);
            totalSlots +=
                effectiveSchedules.reduce((sum, schedule) => {
                    return (sum +
                        (0, appointment_utils_1.generateTimeSlots)(schedule.start_time, schedule.end_time, SLOT_DURATION_MINUTES).length);
                }, 0);
        }
        // =================================================
        // BOOKED COUNT
        // =================================================
        const bookedCount = await repository.countBookedAppointmentsForEmployee(employeeId, appointmentDate);
        const percentage = totalSlots > 0
            ? Math.min(100, Math.round((bookedCount /
                totalSlots) * 100))
            : 0;
        return {
            date: dateStr,
            day_of_week: dayOfWeek,
            total_slots: totalSlots,
            booked_count: bookedCount,
            percentage
        };
    }
    // =====================================================
    // WEEKLY SLOT SUMMARY
    // =====================================================
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
        let totalSlots = 0;
        // =================================================
        // MONDAY -> SUNDAY
        // =================================================
        for (let i = 0; i < 7; i++) {
            const day = new Date(start);
            day.setUTCDate(start.getUTCDate() + i);
            const dayOfWeek = (0, appointment_utils_1.toDayOfWeek)(day);
            // =============================================
            // NORMAL SCHEDULE BRANCHES
            // =============================================
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
            // =============================================
            // DATE CHANGE BRANCHES
            // =============================================
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
            // =============================================
            // PROCESS BRANCHES
            // =============================================
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
        // =================================================
        // BOOKED COUNT
        // =================================================
        const bookedCount = await repository.countBookedAppointmentsForEmployeeInRange(employeeId, start, end);
        const percentage = totalSlots > 0
            ? Math.min(100, Math.round((bookedCount /
                totalSlots) * 100))
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
exports.default = AppointmentService;
