import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { generateId } from "../../utils/idGenerator";
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

}