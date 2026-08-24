import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { generateId } from "../../utils/idGenerator";
import {
    APPOINTMENT_STATUS,
    TERMINAL_APPOINTMENT_STATUSES
} from "../appointment/appointment.constants";
import { GetDoctorLeaveQuery } from "./doctorLeave.types";

export class DoctorLeaveRepository {

    async generateLeaveId(tx: Prisma.TransactionClient) {
        return generateId(tx, "DOCTOR_LEAVE");
    }

    async findDoctorWithRole(employeeId: string) {
        return prisma.employees.findUnique({
            where: { employee_id: employeeId },
            include: {
                user_table: true,
                doctor_profile: true
            }
        });
    }

    async findReplacementDoctor(employeeId: string) {
        return prisma.employees.findUnique({
            where: { employee_id: employeeId },
            include: {
                user_table: true,
                doctor_profile: true
            }
        });
    }

    async findLeaveById(leaveId: string) {
        return prisma.doctor_leave.findUnique({
            where: {
                leave_id: leaveId
            }
        });
    }

    async findPendingLeave(employeeId: string) {
        return prisma.doctor_leave.findFirst({
            where: {
                employee_id: employeeId,
                status: "PENDING"
            }
        });
    }

    async applyLeave(
        tx: Prisma.TransactionClient,
        data: Prisma.doctor_leaveUncheckedCreateInput
    ) {
        return tx.doctor_leave.create({
            data
        });
    }

    async approveLeave(
        tx: Prisma.TransactionClient,
        leaveId: string,
        data: Prisma.doctor_leaveUncheckedUpdateInput
    ) {
        return tx.doctor_leave.update({
            where: {
                leave_id: leaveId
            },
            data
        });
    }

    async rejectLeave(
        tx: Prisma.TransactionClient,
        leaveId: string,
        data: Prisma.doctor_leaveUncheckedUpdateInput
    ) {
        return tx.doctor_leave.update({
            where: {
                leave_id: leaveId
            },
            data
        });
    }

    async getDoctorLeaves(query: GetDoctorLeaveQuery) {

        const {
            employee_id,
            status,
            page = 1,
            limit = 10
        } = query;

        const where: Prisma.doctor_leaveWhereInput = {};

        if (employee_id) {
            where.employee_id = employee_id;
        }

        if (status) {
            where.status = status;
        }

        const [leaves, total] = await Promise.all([

            prisma.doctor_leave.findMany({
                where,
                orderBy: {
                    requested_at: "desc"
                },
                skip: (page - 1) * limit,
                take: limit
            }),

            prisma.doctor_leave.count({
                where
            })

        ]);

        return {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            leaves
        };

    }

    async findActiveAppointmentsInRange(
        tx: Prisma.TransactionClient | typeof prisma,
        employeeId: string,
        dateFrom: string,
        dateTo: string
    ) {

        return (tx as Prisma.TransactionClient).appointment_history.findMany({
            where: {
                employee_id: employeeId,
                appointment_date: {
                    gte: new Date(`${dateFrom}T00:00:00.000Z`),
                    lte: new Date(`${dateTo}T23:59:59.999Z`)
                },
                status: {
                    notIn: [
                        ...TERMINAL_APPOINTMENT_STATUSES,
                        APPOINTMENT_STATUS.RESCHEDULE_REQUIRED
                    ]
                }
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
                        patient_middle_name: true,
                        patient_last_name: true
                    }
                }
            },
            orderBy: [
                { appointment_date: "asc" },
                { appointment_time: "asc" }
            ]
        });

    }

    async markAppointmentRescheduleRequired(
        tx: Prisma.TransactionClient,
        appointmentId: string
    ) {
        return tx.appointment_history.update({
            where: { appointment_id: appointmentId },
            data: { status: APPOINTMENT_STATUS.RESCHEDULE_REQUIRED }
        });
    }

    async createRescheduleQueueEntry(
        tx: Prisma.TransactionClient,
        data: Prisma.appointment_reschedule_queueUncheckedCreateInput
    ) {
        return tx.appointment_reschedule_queue.create({ data });
    }

}