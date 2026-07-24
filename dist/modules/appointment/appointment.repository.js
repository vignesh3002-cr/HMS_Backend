"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const idGenerator_1 = require("../../utils/idGenerator");
const appointment_constants_1 = require("./appointment.constants");
const appointmentDetailInclude = {
    patient_bio_data: {
        select: {
            patient_id: true,
            patient_first_name: true,
            patient_middle_name: true,
            patient_last_name: true,
            patient_gender: true,
            patient_primary_mobile: true
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
};
class AppointmentRepository {
    async findPatient(patientId) {
        return prisma_1.default.patient_bio_data.findUnique({
            where: { patient_id: patientId }
        });
    }
    async findEmployee(employeeId) {
        return prisma_1.default.employees.findUnique({
            where: { employee_id: employeeId },
            include: {
                user_table: {
                    select: { role_type: true, user_status: true }
                },
                doctor_profile: true
            }
        });
    }
    async findBranch(branchId) {
        return prisma_1.default.branch.findUnique({
            where: { branch_id: branchId }
        });
    }
    async findDepartment(departmentId) {
        return prisma_1.default.department_master.findUnique({
            where: { department_id: departmentId }
        });
    }
    async findDoctorBranchMapping(employeeId, branchId) {
        return prisma_1.default.user_branch_mapping.findFirst({
            where: {
                employee_id: employeeId,
                branch_id: branchId,
                status: 1
            }
        });
    }
    // A doctor can have more than one active shift on the same day_of_week
    // (e.g. morning + evening), so this returns all of them, not just one.
    async findActiveDoctorSchedules(employeeId, branchId, dayOfWeek) {
        return prisma_1.default.doctor_schedule.findMany({
            where: {
                employee_id: employeeId,
                branch_id: branchId,
                day_of_week: dayOfWeek,
                is_active: true
            },
            orderBy: { start_time: "asc" }
        });
    }
    async findBookedAppointmentTimes(employeeId, appointmentDate) {
        const appointments = await prisma_1.default.appointment_history.findMany({
            where: {
                employee_id: employeeId,
                appointment_date: appointmentDate,
                status: { notIn: appointment_constants_1.NON_BLOCKING_APPOINTMENT_STATUSES }
            },
            select: { appointment_time: true }
        });
        return appointments.map((appointment) => appointment.appointment_time);
    }
    // Serializes concurrent bookings against the same schedule so two
    // requests can never read the same MAX(token_number) and both insert it.
    async lockDoctorSchedule(tx, scheduleId) {
        await tx.$queryRaw `SELECT schedule_id FROM doctor_schedule WHERE schedule_id = ${scheduleId} FOR UPDATE`;
    }
    async findDuplicateAppointment(employeeId, appointmentDate, appointmentTime, excludeAppointmentId) {
        return prisma_1.default.appointment_history.findFirst({
            where: {
                employee_id: employeeId,
                appointment_date: appointmentDate,
                appointment_time: appointmentTime,
                status: { notIn: appointment_constants_1.NON_BLOCKING_APPOINTMENT_STATUSES },
                ...(excludeAppointmentId
                    ? { appointment_id: { not: excludeAppointmentId } }
                    : {})
            }
        });
    }
    async generateAppointmentNumber(tx) {
        return (0, idGenerator_1.generateId)(tx, "APPOINTMENT");
    }
    // Must run after lockDoctorSchedule() inside the same transaction.
    async generateTokenNumber(tx, scheduleId, appointmentDate) {
        const result = await tx.appointment_history.aggregate({
            where: {
                schedule_id: scheduleId,
                appointment_date: appointmentDate
            },
            _max: {
                token_number: true
            }
        });
        return (result._max.token_number ?? 0) + 1;
    }
    async createAppointment(tx, data) {
        return tx.appointment_history.create({ data });
    }
    async updateAppointment(tx, appointmentId, data) {
        return tx.appointment_history.update({
            where: { appointment_id: appointmentId },
            data
        });
    }
    async updateAppointmentStatus(appointmentId, status, cancelReason) {
        return prisma_1.default.appointment_history.update({
            where: { appointment_id: appointmentId },
            data: { status, cancel_reason: cancelReason }
        });
    }
    async getAppointmentByNumber(appointmentId) {
        return prisma_1.default.appointment_history.findUnique({
            where: { appointment_id: appointmentId },
            include: appointmentDetailInclude
        });
    }
    async getAppointments(query) {
        const { branchId, employeeId, patientId, status, date, dateFrom, dateTo, sortBy = "appointment_date", sortOrder = "desc", page = 1, limit = 10 } = query;
        const where = {};
        if (branchId)
            where.branch_id = branchId;
        if (employeeId)
            where.employee_id = employeeId;
        if (patientId)
            where.patient_id = patientId;
        if (status)
            where.status = status;
        if (date) {
            where.appointment_date = parseDate(date);
        }
        else if (dateFrom || dateTo) {
            where.appointment_date = {
                ...(dateFrom ? { gte: parseDate(dateFrom) } : {}),
                ...(dateTo ? { lte: parseDate(dateTo) } : {})
            };
        }
        const orderBy = sortBy === "created_at"
            ? { created_at: sortOrder }
            : sortBy === "token_number"
                ? { token_number: sortOrder }
                : sortBy === "status"
                    ? { status: sortOrder }
                    : { appointment_date: sortOrder };
        const [appointments, total] = await Promise.all([
            prisma_1.default.appointment_history.findMany({
                where,
                include: appointmentDetailInclude,
                orderBy,
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma_1.default.appointment_history.count({ where })
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
exports.AppointmentRepository = AppointmentRepository;
function parseDate(date) {
    return new Date(date);
}
