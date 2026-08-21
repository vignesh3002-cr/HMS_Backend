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
    // =========================================================
    // PATIENT
    // =========================================================
    async findPatient(patientId) {
        return prisma_1.default.patient_bio_data.findUnique({
            where: {
                patient_id: patientId
            }
        });
    }
    // =========================================================
    // EMPLOYEE / DOCTOR
    // =========================================================
    async findEmployee(employeeId) {
        return prisma_1.default.employees.findUnique({
            where: {
                employee_id: employeeId
            },
            include: {
                user_table: {
                    select: {
                        role_type: true,
                        user_status: true
                    }
                },
                doctor_profile: true
            }
        });
    }
    // =========================================================
    // BRANCH
    // =========================================================
    async findBranch(branchId) {
        return prisma_1.default.branch.findUnique({
            where: {
                branch_id: branchId
            }
        });
    }
    // =========================================================
    // DEPARTMENT
    // =========================================================
    async findDepartment(departmentId) {
        return prisma_1.default.department_master.findUnique({
            where: {
                department_id: departmentId
            }
        });
    }
    // =========================================================
    // DOCTOR / BRANCH MAPPING
    // =========================================================
    async findDoctorBranchMapping(employeeId, branchId) {
        return prisma_1.default.user_branch_mapping.findFirst({
            where: {
                employee_id: employeeId,
                branch_id: branchId,
                status: 1
            }
        });
    }
    // =========================================================
    // DOCTOR SCHEDULES
    // =========================================================
    /**
     * Returns active recurring schedules for a doctor,
     * branch and weekday.
     *
     * These represent the NORMAL weekly schedule.
     */
    async findActiveDoctorSchedules(employeeId, branchId, dayOfWeek) {
        return prisma_1.default.doctor_schedule.findMany({
            where: {
                employee_id: employeeId,
                branch_id: branchId,
                day_of_week: dayOfWeek,
                is_active: true
            },
            orderBy: {
                start_time: "asc"
            }
        });
    }
    /**
     * Returns all active schedules for an employee
     * across branches.
     *
     * Used for doctor capacity calculations.
     */
    async findActiveDoctorSchedulesForEmployee(employeeId, dayOfWeek) {
        return prisma_1.default.doctor_schedule.findMany({
            where: {
                employee_id: employeeId,
                day_of_week: dayOfWeek,
                is_active: true
            }
        });
    }
    /**
     * Returns a schedule that can be used as the
     * schedule_id reference for a date-specific ADD/OVERRIDE.
     *
     * IMPORTANT:
     *
     * is_active is intentionally NOT required here.
     *
     * When a recurring day is toggled OFF, the original
     * doctor_schedule row remains in the database but becomes
     * inactive.
     *
     * A date-specific ADD on that OFF day still needs a valid
     * doctor_schedule.schedule_id because appointment_history
     * references doctor_schedule.
     */
    async findReferenceSchedule(employeeId, branchId) {
        return prisma_1.default.doctor_schedule.findFirst({
            where: {
                employee_id: employeeId,
                branch_id: branchId
            },
            orderBy: [
                {
                    is_active: "desc"
                },
                {
                    start_time: "asc"
                }
            ]
        });
    }
    // =========================================================
    // DATE-SPECIFIC SCHEDULE CHANGES
    // =========================================================
    /**
     * Returns active ADD / OVERRIDE / CANCEL changes for
     * the requested doctor, branch and calendar date.
     *
     * IMPORTANT:
     *
     * Do NOT compare change_date directly with appointmentDate.
     *
     * appointmentDate represents a calendar date, while the
     * database timestamp may contain a time component.
     *
     * Example:
     *
     * appointmentDate:
     *   2026-08-27T00:00:00.000Z
     *
     * Database:
     *   2026-08-27T05:30:00.000Z
     *
     * An exact equality check would NOT find the row.
     *
     * Therefore we search:
     *
     *   >= start of requested day
     *   <  start of next day
     *
     * This is especially important for:
     *
     * Day View OFF
     *      ↓
     * Week View ADD
     *      ↓
     * doctor_schedule_change row created
     *      ↓
     * appointment slots generated
     */
    async findDoctorScheduleChange(employeeId, branchId, appointmentDate) {
        const startOfDay = new Date(appointmentDate);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const startOfNextDay = new Date(startOfDay);
        startOfNextDay.setUTCDate(startOfNextDay.getUTCDate() + 1);
        return prisma_1.default.doctor_schedule_change.findMany({
            where: {
                employee_id: employeeId,
                branch_id: branchId,
                change_date: {
                    gte: startOfDay,
                    lt: startOfNextDay
                },
                is_active: true
            },
            orderBy: {
                created_at: "asc"
            }
        });
    }
    // =========================================================
    // APPOINTMENT COUNTS
    // =========================================================
    async countBookedAppointmentsForEmployee(employeeId, appointmentDate) {
        return prisma_1.default.appointment_history.count({
            where: {
                employee_id: employeeId,
                appointment_date: appointmentDate,
                status: {
                    notIn: appointment_constants_1.NON_BLOCKING_APPOINTMENT_STATUSES
                }
            }
        });
    }
    async countBookedAppointmentsForEmployeeInRange(employeeId, startDate, endDate) {
        return prisma_1.default.appointment_history.count({
            where: {
                employee_id: employeeId,
                appointment_date: {
                    gte: startDate,
                    lte: endDate
                },
                status: {
                    notIn: appointment_constants_1.NON_BLOCKING_APPOINTMENT_STATUSES
                }
            }
        });
    }
    // =========================================================
    // BOOKED APPOINTMENT TIMES
    // =========================================================
    async findBookedAppointmentTimes(employeeId, appointmentDate) {
        const appointments = await prisma_1.default.appointment_history.findMany({
            where: {
                employee_id: employeeId,
                appointment_date: appointmentDate,
                status: {
                    notIn: appointment_constants_1.NON_BLOCKING_APPOINTMENT_STATUSES
                }
            },
            select: {
                appointment_time: true
            }
        });
        return appointments.map((appointment) => appointment.appointment_time);
    }
    // =========================================================
    // CONCURRENCY / TOKEN
    // =========================================================
    /**
     * Serializes concurrent bookings against the same
     * doctor schedule.
     */
    async lockDoctorSchedule(tx, scheduleId) {
        await tx.$queryRaw `
            SELECT schedule_id
            FROM doctor_schedule
            WHERE schedule_id = ${scheduleId}
            FOR UPDATE
        `;
    }
    async generateAppointmentNumber(tx) {
        return (0, idGenerator_1.generateId)(tx, "APPOINTMENT");
    }
    /**
     * Must run after lockDoctorSchedule() inside the
     * same transaction.
     */
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
    // =========================================================
    // DUPLICATE APPOINTMENT
    // =========================================================
    async findDuplicateAppointment(employeeId, appointmentDate, appointmentTime, excludeAppointmentId) {
        return prisma_1.default.appointment_history.findFirst({
            where: {
                employee_id: employeeId,
                appointment_date: appointmentDate,
                appointment_time: appointmentTime,
                status: {
                    notIn: appointment_constants_1.NON_BLOCKING_APPOINTMENT_STATUSES
                },
                ...(excludeAppointmentId
                    ? {
                        appointment_id: {
                            not: excludeAppointmentId
                        }
                    }
                    : {})
            }
        });
    }
    // =========================================================
    // CREATE / UPDATE APPOINTMENT
    // =========================================================
    async createAppointment(tx, data) {
        return tx.appointment_history.create({
            data
        });
    }
    async updateAppointment(tx, appointmentId, data) {
        return tx.appointment_history.update({
            where: {
                appointment_id: appointmentId
            },
            data
        });
    }
    // =========================================================
    // APPOINTMENT STATUS
    // =========================================================
    async updateAppointmentStatus(appointmentId, status, cancelReason, cancelledBy) {
        return prisma_1.default.appointment_history.update({
            where: {
                appointment_id: appointmentId
            },
            data: {
                status,
                cancel_reason: cancelReason,
                ...(status ===
                    appointment_constants_1.APPOINTMENT_STATUS.CANCELLED
                    ? {
                        cancelled_at: new Date(),
                        cancelled_by: cancelledBy ?? null,
                        notification_status: "NOT_REQUIRED"
                    }
                    : {})
            }
        });
    }
    // =========================================================
    // APPOINTMENT FETCH
    // =========================================================
    async getAppointmentByNumber(appointmentId) {
        return prisma_1.default.appointment_history.findUnique({
            where: {
                appointment_id: appointmentId
            },
            include: appointmentDetailInclude
        });
    }
    // =========================================================
    // RESCHEDULE QUEUE
    // =========================================================
    async findOpenRescheduleQueueEntries(tx, appointmentId) {
        return tx.appointment_reschedule_queue.findMany({
            where: {
                appointment_id: appointmentId,
                status: {
                    in: [
                        "PENDING",
                        "ASSIGNED"
                    ]
                }
            },
            orderBy: {
                created_at: "desc"
            }
        });
    }
    async closeRescheduleQueueEntry(tx, queueId, performedBy) {
        await tx.appointment_reschedule_queue.update({
            where: {
                queue_id: queueId
            },
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
    // =========================================================
    // APPOINTMENT LIST
    // =========================================================
    async getAppointments(query) {
        const { branchId, employeeId, patientId, status, date, dateFrom, dateTo, sortBy = "appointment_date", sortOrder = "desc", page = 1, limit = 10 } = query;
        const where = {};
        if (branchId) {
            where.branch_id = branchId;
        }
        if (employeeId) {
            where.employee_id = employeeId;
        }
        if (patientId) {
            where.patient_id = patientId;
        }
        if (status) {
            where.status = status;
        }
        if (date) {
            where.appointment_date =
                parseDate(date);
        }
        else if (dateFrom || dateTo) {
            where.appointment_date = {
                ...(dateFrom
                    ? {
                        gte: parseDate(dateFrom)
                    }
                    : {}),
                ...(dateTo
                    ? {
                        lte: parseDate(dateTo)
                    }
                    : {})
            };
        }
        const orderBy = sortBy === "created_at"
            ? {
                created_at: sortOrder
            }
            : sortBy === "token_number"
                ? {
                    token_number: sortOrder
                }
                : sortBy === "status"
                    ? {
                        status: sortOrder
                    }
                    : {
                        appointment_date: sortOrder
                    };
        const [appointments, total] = await Promise.all([
            prisma_1.default.appointment_history.findMany({
                where,
                include: appointmentDetailInclude,
                orderBy,
                skip: (page - 1) *
                    limit,
                take: limit
            }),
            prisma_1.default.appointment_history.count({
                where
            })
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
// =========================================================
// DATE HELPER
// =========================================================
function parseDate(date) {
    return new Date(date);
}
