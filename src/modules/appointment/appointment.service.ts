import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { AppointmentRepository } from "./appointment.repository";
import {
    CreateAppointmentDTO,
    UpdateAppointmentDTO,
    GetAppointmentsQuery
} from "./appointment.types";
import {
    APPOINTMENT_STATUS,
    TERMINAL_APPOINTMENT_STATUSES
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
    getWeekRange
} from "./appointment.utils";

const repository = new AppointmentRepository();

// Fixed slot length used to count a doctor's total daily/weekly slot
// capacity for the availability progress bar, independent of whichever
// consultation_minutes value an individual schedule row carries.
const SLOT_DURATION_MINUTES = 20;

type DoctorSchedule = Awaited<
    ReturnType<AppointmentRepository["findActiveDoctorSchedules"]>
>[number];

interface BookingContext {
    employee: NonNullable<
        Awaited<ReturnType<AppointmentRepository["findEmployee"]>>
    >;
    branch: NonNullable<
        Awaited<ReturnType<AppointmentRepository["findBranch"]>>
    >;
    department: Awaited<
        ReturnType<AppointmentRepository["findDepartment"]>
    > | null;
    schedules: DoctorSchedule[];
}

export class AppointmentService {

    private async validateBookingContext(
        employeeId: string,
        branchId: string,
        departmentId: string | undefined,
        appointmentDate: Date
    ): Promise<BookingContext> {

        const employee = await repository.findEmployee(employeeId);

        if (!employee) {
            throw new Error("Doctor not found");
        }

        if (employee.user_table?.role_type !== "DOCTOR") {
            throw new Error("Selected employee is not a doctor");
        }

        const branch = await repository.findBranch(branchId);

        if (!branch) {
            throw new Error("Branch not found");
        }

        if (branch.branch_status !== "Active") {
            throw new Error("Selected branch is inactive");
        }

        const mapping = await repository.findDoctorBranchMapping(
            employeeId,
            branchId
        );

        if (!mapping) {
            throw new Error("Doctor is not assigned to the selected branch");
        }

        let department = null;

        if (departmentId) {

            department = await repository.findDepartment(departmentId);

            if (!department) {
                throw new Error("Department not found");
            }

        }

        const dayOfWeek = toDayOfWeek(appointmentDate);

        const schedules = await repository.findActiveDoctorSchedules(
            employeeId,
            branchId,
            dayOfWeek
        );

        if (schedules.length === 0) {
            throw new Error(
                `Doctor has no active schedule at this branch on ${dayOfWeek}`
            );
        }

        return { employee, branch, department, schedules };

    }

    // Picks whichever of the doctor's (possibly multiple) shifts that day
    // actually covers the requested time, instead of assuming a single shift.
    private pickScheduleForTime(
        schedules: DoctorSchedule[],
        appointmentTime: string
    ): DoctorSchedule {

        const requestedMinutes = timeToMinutes(
            timeStringToDate(appointmentTime)
        );

        const match = schedules.find((schedule) => {

            if (!schedule.start_time || !schedule.end_time) {
                return false;
            }

            const startMinutes = timeToMinutes(schedule.start_time);
            const endMinutes = timeToMinutes(schedule.end_time);

            return requestedMinutes >= startMinutes && requestedMinutes < endMinutes;

        });

        if (!match) {
            throw new Error(
                "Selected time is outside the doctor's working hours"
            );
        }

        return match;

    }

    async bookAppointment(
        data: CreateAppointmentDTO,
        createdBy: string
    ) {

        const patient = await repository.findPatient(data.patient_id);

        if (!patient) {
            throw new Error("Patient not found");
        }

        const appointmentDate = parseDateOnly(data.appointment_date);

        const {
            employee,
            department,
            schedules
        } = await this.validateBookingContext(
            data.employee_id,
            data.branch_id,
            data.department_id,
            appointmentDate
        );

        // STEP 3:
        // Prevent an appointment from being booked when the doctor
        // has an APPROVED leave covering the selected date.
        const approvedLeave = await repository.findApprovedDoctorLeave(
            data.employee_id,
            appointmentDate
        );

        if (approvedLeave) {
            throw new Error(
                "Doctor is on approved leave on the selected date"
            );
        }

        const schedule = this.pickScheduleForTime(
            schedules,
            data.appointment_time
        );

        const appointmentTime = timeStringToDate(
            data.appointment_time
        );

        const duplicate = await repository.findDuplicateAppointment(
            data.employee_id,
            appointmentDate,
            appointmentTime
        );

        if (duplicate) {
            throw new Error(
                "This doctor already has an appointment at the selected date and time"
            );
        }

        const doctorName =
            `${employee.first_name} ${employee.last_name}`.trim();

        return prisma.$transaction(async (tx) => {

            await repository.lockDoctorSchedule(
                tx,
                schedule.schedule_id
            );

            const stillDuplicate =
                await tx.appointment_history.findFirst({
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
                throw new Error(
                    "This doctor already has an appointment at the selected date and time"
                );
            }

            const appointmentId =
                await repository.generateAppointmentNumber(tx);

            const tokenNumber =
                await repository.generateTokenNumber(
                    tx,
                    schedule.schedule_id,
                    appointmentDate
                );

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
                status: APPOINTMENT_STATUS.SCHEDULED,
                reason_for_visit: data.reason_for_visit,
                referred_by: data.referred_by,
                booking_source: data.booking_source ?? "STAFF",
                doctor_name: doctorName,
                assigned_doctor: doctorName,
                department: department?.department_name,
                created_by: createdBy

            });

        });

    }

    async getAppointments(
        query: GetAppointmentsQuery
    ) {

        return repository.getAppointments(query);

    }

    async getAppointmentByNumber(
        appointmentNo: string
    ) {

        const appointment =
            await repository.getAppointmentByNumber(
                appointmentNo
            );

        if (!appointment) {
            throw new Error("Appointment not found");
        }

        return appointment;

    }

    async updateAppointment(
        appointmentNo: string,
        data: UpdateAppointmentDTO
    ) {

        const existing =
            await repository.getAppointmentByNumber(
                appointmentNo
            );

        if (!existing) {
            throw new Error("Appointment not found");
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
                ? parseDateOnly(data.appointment_date)
                : existing.appointment_date;

        const appointmentTimeStr =
            data.appointment_time ??
            formatTimeOfDay(existing.appointment_time);

        const scheduleChanged =
            !!data.employee_id ||
            !!data.branch_id ||
            !!data.appointment_date ||
            !!data.appointment_time;

        return prisma.$transaction(async (tx) => {

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
                } = await this.validateBookingContext(
                    employeeId,
                    branchId,
                    departmentId,
                    appointmentDate
                );

                // Also prevent rescheduling an existing appointment
                // onto a doctor's approved leave date.
                const approvedLeave =
                    await repository.findApprovedDoctorLeave(
                        employeeId,
                        appointmentDate
                    );

                if (approvedLeave) {
                    throw new Error(
                        "Doctor is on approved leave on the selected date"
                    );
                }

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
                    department?.department_name ?? null;

            }

            const appointmentTime =
                timeStringToDate(
                    appointmentTimeStr
                );

            const updateData:
                Prisma.appointment_historyUncheckedUpdateInput = {

                appointment_date:
                    appointmentDate,

                appointment_time:
                    appointmentTime,

                reason_for_visit:
                    data.reason_for_visit,

                referred_by:
                    data.referred_by

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

            return repository.updateAppointment(
                tx,
                appointmentNo,
                updateData
            );

        });

    }

    async updateAppointmentStatus(
        appointmentNo: string,
        status: string,
        cancelReason?: string
    ) {

        const existing =
            await repository.getAppointmentByNumber(
                appointmentNo
            );

        if (!existing) {
            throw new Error("Appointment not found");
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
            status === APPOINTMENT_STATUS.CANCELLED &&
            !cancelReason
        ) {
            throw new Error(
                "Cancellation reason is required when cancelling an appointment"
            );
        }

        return repository.updateAppointmentStatus(
            appointmentNo,
            status,
            cancelReason
        );

    }

    async cancelAppointment(
        appointmentNo: string,
        cancelReason: string
    ) {

        return this.updateAppointmentStatus(
            appointmentNo,
            APPOINTMENT_STATUS.CANCELLED,
            cancelReason
        );

    }

    async getAvailableSlots(
        employeeId: string,
        branchId: string,
        dateStr: string
    ) {

        const employee =
            await repository.findEmployee(
                employeeId
            );

        if (!employee) {
            throw new Error("Doctor not found");
        }

        if (
            employee.user_table?.role_type !== "DOCTOR"
        ) {
            throw new Error(
                "Selected employee is not a doctor"
            );
        }

        const branch =
            await repository.findBranch(
                branchId
            );

        if (!branch) {
            throw new Error("Branch not found");
        }

        if (branch.branch_status !== "Active") {
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
            parseDateOnly(dateStr);

        const dayOfWeek =
            toDayOfWeek(appointmentDate);

        // STEP 2:
        // Check whether the doctor has an approved leave
        // covering the requested appointment date.
        const approvedLeave =
            await repository.findApprovedDoctorLeave(
                employeeId,
                appointmentDate
            );

        // If the doctor is on approved leave, return no slots.
        if (approvedLeave) {

            return {
                date: dateStr,
                day_of_week: dayOfWeek,
                slots: []
            };

        }

        const schedules =
            await repository.findActiveDoctorSchedules(
                employeeId,
                branchId,
                dayOfWeek
            );

        if (schedules.length === 0) {

            return {
                date: dateStr,
                day_of_week: dayOfWeek,
                slots: []
            };

        }

        const bookedTimes =
            await repository.findBookedAppointmentTimes(
                employeeId,
                appointmentDate
            );

        const bookedSet =
            new Set(
                bookedTimes.map(formatTimeOfDay)
            );

        // "Past" only applies when the requested date is today, compared using
        // the server's local wall-clock - the same convention HH:mm strings are
        // entered and stored under (see the note in appointment.utils.ts).
        const now = new Date();

        const isToday =
            appointmentDate.getUTCFullYear() ===
                now.getFullYear() &&
            appointmentDate.getUTCMonth() ===
                now.getMonth() &&
            appointmentDate.getUTCDate() ===
                now.getDate();

        const nowMinutes =
            now.getHours() * 60 +
            now.getMinutes();

        const slots =
            schedules.flatMap((schedule) => {

                if (
                    !schedule.start_time ||
                    !schedule.end_time
                ) {
                    return [];
                }

                const times =
                    generateTimeSlots(
                        schedule.start_time,
                        schedule.end_time,
                        schedule.consultation_minutes ?? 20
                    );

                return times
                    .filter(
                        (time) =>
                            !isToday ||
                            timeStringToMinutes(time) >
                                nowMinutes
                    )
                    .map((time) => ({
                        schedule_id:
                            schedule.schedule_id,

                        shift_name:
                            schedule.shift_name,

                        time,

                        is_available:
                            !bookedSet.has(time)
                    }));

            });

        return {
            date: dateStr,
            day_of_week: dayOfWeek,
            slots
        };

    }

    // Total slot capacity for a doctor on a given day = every active shift
    // of theirs (across every branch) on that day-of-week, sliced into fixed
    // 20-minute slots based on their working-hours availability - independent
    // of who ends up booking them, and independent of any per-schedule
    // consultation_minutes override.
    async getDoctorSlotSummary(
        employeeId: string,
        dateStr: string
    ) {

        const employee =
            await repository.findEmployee(
                employeeId
            );

        if (!employee) {
            throw new Error("Doctor not found");
        }

        const appointmentDate =
            parseDateOnly(dateStr);

        const dayOfWeek =
            toDayOfWeek(appointmentDate);

        const schedules =
            await repository.findActiveDoctorSchedulesForEmployee(
                employeeId,
                dayOfWeek
            );

        const totalSlots =
            schedules.reduce(
                (sum, schedule) => {

                    if (
                        !schedule.start_time ||
                        !schedule.end_time
                    ) {
                        return sum;
                    }

                    return sum +
                        generateTimeSlots(
                            schedule.start_time,
                            schedule.end_time,
                            SLOT_DURATION_MINUTES
                        ).length;

                },
                0
            );

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
                        (bookedCount / totalSlots) * 100
                    )
                )
                : 0;

        return {
            date: dateStr,
            day_of_week: dayOfWeek,
            total_slots: totalSlots,
            booked_count: bookedCount,
            percentage
        };

    }

    // Same idea as getDoctorSlotSummary, but summed across the whole
    // Monday-Sunday week containing `dateStr` - total slot capacity across
    // all 7 days' schedules, and booked count across the whole date range.
    async getDoctorWeekSlotSummary(
        employeeId: string,
        dateStr: string
    ) {

        const employee =
            await repository.findEmployee(
                employeeId
            );

        if (!employee) {
            throw new Error("Doctor not found");
        }

        const anchorDate =
            parseDateOnly(dateStr);

        const {
            start,
            end
        } = getWeekRange(anchorDate);

        let totalSlots = 0;

        for (let i = 0; i < 7; i++) {

            const day =
                new Date(start);

            day.setUTCDate(
                start.getUTCDate() + i
            );

            const dayOfWeek =
                toDayOfWeek(day);

            const schedules =
                await repository.findActiveDoctorSchedulesForEmployee(
                    employeeId,
                    dayOfWeek
                );

            totalSlots +=
                schedules.reduce(
                    (sum, schedule) => {

                        if (
                            !schedule.start_time ||
                            !schedule.end_time
                        ) {
                            return sum;
                        }

                        return sum +
                            generateTimeSlots(
                                schedule.start_time,
                                schedule.end_time,
                                SLOT_DURATION_MINUTES
                            ).length;

                    },
                    0
                );

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
                        (bookedCount / totalSlots) * 100
                    )
                )
                : 0;

        return {
            week_start:
                formatDateOnly(start),

            week_end:
                formatDateOnly(end),

            total_slots:
                totalSlots,

            booked_count:
                bookedCount,

            percentage
        };

    }

}