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
    timeToMinutes,
    formatTimeOfDay,
    parseDateOnly
} from "./appointment.utils";

const repository = new AppointmentRepository();

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
    schedule: NonNullable<
        Awaited<ReturnType<AppointmentRepository["findDoctorSchedule"]>>
    >;
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

        const schedule = await repository.findDoctorSchedule(
            employeeId,
            branchId,
            dayOfWeek
        );
        console.log("Schedule:", schedule);

        if (!schedule) {
            throw new Error(
                `Doctor has no active schedule at this branch on ${dayOfWeek}`
            );
        }

        return { employee, branch, department, schedule };

    }

    private assertWithinWorkingHours(
        schedule: { start_time: Date | null; end_time: Date | null },
        appointmentTime: string
    ) {

        if (!schedule.start_time || !schedule.end_time) {
            throw new Error(
                "Doctor schedule has no working hours configured"
            );
        }

        const requestedMinutes = timeToMinutes(
            timeStringToDate(appointmentTime)
        );

        const startMinutes = timeToMinutes(schedule.start_time);
        const endMinutes = timeToMinutes(schedule.end_time);
        console.log("Requested:", requestedMinutes, "Start:", startMinutes, "End:", endMinutes);

        if (requestedMinutes < startMinutes || requestedMinutes >= endMinutes) {
            throw new Error(
                "Selected time is outside the doctor's working hours"
            );
        }

    }

    async bookAppointment(data: CreateAppointmentDTO, createdBy: string) {

        const patient = await repository.findPatient(data.patient_id);

        if (!patient) {
            throw new Error("Patient not found");
        }

        const appointmentDate = parseDateOnly(data.appointment_date);

        const { employee, department, schedule } =
            await this.validateBookingContext(
                data.employee_id,
                data.branch_id,
                data.department_id,
                appointmentDate
            );

        this.assertWithinWorkingHours(schedule, data.appointment_time);

        const appointmentTime = timeStringToDate(data.appointment_time);

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

        const doctorName = `${employee.first_name} ${employee.last_name}`.trim();

        return prisma.$transaction(async (tx) => {

            await repository.lockDoctorSchedule(tx, schedule.schedule_id);

            const stillDuplicate = await tx.appointment_history.findFirst({
                where: {
                    employee_id: data.employee_id,
                    appointment_date: appointmentDate,
                    appointment_time: appointmentTime,
                    status: { notIn: ["CANCELLED", "NO_SHOW"] }
                }
            });

            if (stillDuplicate) {
                throw new Error(
                    "This doctor already has an appointment at the selected date and time"
                );
            }

            const appointmentId = await repository.generateAppointmentNumber(tx);

            const tokenNumber = await repository.generateTokenNumber(
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
                status: APPOINTMENT_STATUS.BOOKED,
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

    async getAppointments(query: GetAppointmentsQuery) {

        return repository.getAppointments(query);

    }

    async getAppointmentByNumber(appointmentNo: string) {

        const appointment = await repository.getAppointmentByNumber(appointmentNo);

        if (!appointment) {
            throw new Error("Appointment not found");
        }

        return appointment;

    }

    async updateAppointment(appointmentNo: string, data: UpdateAppointmentDTO) {

        const existing = await repository.getAppointmentByNumber(appointmentNo);

        if (!existing) {
            throw new Error("Appointment not found");
        }

        if (TERMINAL_APPOINTMENT_STATUSES.includes(existing.status ?? "")) {
            throw new Error(
                `Cannot modify an appointment that is already ${existing.status}`
            );
        }

        const employeeId = data.employee_id ?? existing.employee_id!;
        const branchId = data.branch_id ?? existing.branch_id!;
        const departmentId =
            data.department_id ?? existing.department_id ?? undefined;

        const appointmentDate = data.appointment_date
            ? parseDateOnly(data.appointment_date)
            : existing.appointment_date;

        const appointmentTimeStr =
            data.appointment_time ?? formatTimeOfDay(existing.appointment_time);

        const scheduleChanged =
            !!data.employee_id ||
            !!data.branch_id ||
            !!data.appointment_date ||
            !!data.appointment_time;

        return prisma.$transaction(async (tx) => {

            let scheduleId = existing.schedule_id!;
            let tokenNumber = existing.token_number;
            let doctorName = existing.doctor_name;
            let departmentName = existing.department;

            if (scheduleChanged) {

                const { employee, department, schedule } =
                    await this.validateBookingContext(
                        employeeId,
                        branchId,
                        departmentId,
                        appointmentDate
                    );

                this.assertWithinWorkingHours(schedule, appointmentTimeStr);

                const appointmentTime = timeStringToDate(appointmentTimeStr);

                const duplicate = await repository.findDuplicateAppointment(
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

                await repository.lockDoctorSchedule(tx, schedule.schedule_id);

                tokenNumber = await repository.generateTokenNumber(
                    tx,
                    schedule.schedule_id,
                    appointmentDate
                );

                scheduleId = schedule.schedule_id;
                doctorName = `${employee.first_name} ${employee.last_name}`.trim();
                departmentName = department?.department_name ?? null;

            }

            const appointmentTime = timeStringToDate(appointmentTimeStr);

            const updateData: Prisma.appointment_historyUncheckedUpdateInput = {
                appointment_date: appointmentDate,
                appointment_time: appointmentTime,
                reason_for_visit: data.reason_for_visit,
                referred_by: data.referred_by
            };

            if (scheduleChanged) {
                updateData.employee_id = employeeId;
                updateData.branch_id = branchId;
                updateData.department_id = departmentId;
                updateData.schedule_id = scheduleId;
                updateData.token_number = tokenNumber;
                updateData.doctor_name = doctorName;
                updateData.department = departmentName;
            }

            return repository.updateAppointment(tx, appointmentNo, updateData);

        });

    }

    async updateAppointmentStatus(appointmentNo: string, status: string) {

        const existing = await repository.getAppointmentByNumber(appointmentNo);

        if (!existing) {
            throw new Error("Appointment not found");
        }

        if (TERMINAL_APPOINTMENT_STATUSES.includes(existing.status ?? "")) {
            throw new Error(
                `Cannot change status of an appointment that is already ${existing.status}`
            );
        }

        return repository.updateAppointmentStatus(appointmentNo, status);

    }

    async cancelAppointment(appointmentNo: string) {

        return this.updateAppointmentStatus(
            appointmentNo,
            APPOINTMENT_STATUS.CANCELLED
        );

    }

}
