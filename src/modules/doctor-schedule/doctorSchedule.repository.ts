import prisma from "../../config/prisma";

export class DoctorScheduleRepository {

    /**
     * Create a new schedule change
     */
    async createScheduleChange(data: {
        employee_id: string;
        branch_id: string;
        change_date: Date;
        mode: "ADD" | "OVERRIDE" | "CANCEL";
        start_time?: Date | null;
        end_time?: Date | null;
        reason?: string | null;
        created_by?: string | null;
    }) {
        const now = new Date();

        return prisma.doctor_schedule_change.create({
            data: {
                employee_id:
                    data.employee_id,

                branch_id:
                    data.branch_id,

                change_date:
                    data.change_date,

                mode:
                    data.mode,

                start_time:
                    data.start_time ?? null,

                end_time:
                    data.end_time ?? null,

                reason:
                    data.reason ?? null,

                created_by:
                    data.created_by ?? null,

                is_active:
                    true,

                /**
                 * Prisma schema requires updated_at.
                 */
                updated_at:
                    now,
            },
        });
    }

    /**
     * Get all active schedule changes for a doctor
     */
    async findActiveScheduleChanges(
        employeeId: string
    ) {
        return prisma.doctor_schedule_change.findMany({
            where: {
                employee_id:
                    employeeId,

                is_active:
                    true,
            },

            orderBy: [
                {
                    change_date:
                        "asc",
                },
                {
                    created_at:
                        "asc",
                },
            ],
        });
    }

    /**
     * Get active schedule changes for a doctor
     * on a specific date.
     */
    async findScheduleChangesByDate(
        employeeId: string,
        date: Date
    ) {
        return prisma.doctor_schedule_change.findMany({
            where: {
                employee_id:
                    employeeId,

                change_date:
                    date,

                is_active:
                    true,
            },

            orderBy: {
                created_at:
                    "asc",
            },
        });
    }

    /**
     * Find a schedule change by ID.
     */
    async findScheduleChangeById(
        changeId: bigint
    ) {
        return prisma.doctor_schedule_change.findUnique({
            where: {
                change_id:
                    changeId,
            },
        });
    }

    /**
     * Find active changes for a doctor/branch/date.
     *
     * Useful for validation of ADD / OVERRIDE / CANCEL.
     */
    async findActiveScheduleChangesForBranchDate(
        employeeId: string,
        branchId: string,
        date: Date
    ) {
        return prisma.doctor_schedule_change.findMany({
            where: {
                employee_id:
                    employeeId,

                branch_id:
                    branchId,

                change_date:
                    date,

                is_active:
                    true,
            },

            orderBy: {
                created_at:
                    "asc",
            },
        });
    }

    /**
     * Update an existing schedule change.
     *
     * updated_at is also refreshed whenever the
     * record is modified.
     */
    async updateScheduleChange(
        changeId: bigint,
        data: {
            change_date?: Date;
            mode?: "ADD" | "OVERRIDE" | "CANCEL";
            start_time?: Date | null;
            end_time?: Date | null;
            reason?: string | null;
            is_active?: boolean;
        }
    ) {
        return prisma.doctor_schedule_change.update({
            where: {
                change_id:
                    changeId,
            },

            data: {
                ...(data.change_date !== undefined && {
                    change_date:
                        data.change_date,
                }),

                ...(data.mode !== undefined && {
                    mode:
                        data.mode,
                }),

                ...(data.start_time !== undefined && {
                    start_time:
                        data.start_time,
                }),

                ...(data.end_time !== undefined && {
                    end_time:
                        data.end_time,
                }),

                ...(data.reason !== undefined && {
                    reason:
                        data.reason,
                }),

                ...(data.is_active !== undefined && {
                    is_active:
                        data.is_active,
                }),

                /**
                 * Keep updated_at current.
                 */
                updated_at:
                    new Date(),
            },
        });
    }

    /**
     * Deactivate a schedule change.
     *
     * We use is_active=false instead of deleting the record
     * so the schedule-change history is preserved.
     */
    async deactivateScheduleChange(
        changeId: bigint
    ) {
        return prisma.doctor_schedule_change.update({
            where: {
                change_id:
                    changeId,
            },

            data: {
                is_active:
                    false,

                updated_at:
                    new Date(),
            },
        });
    }

    /**
     * Check whether an employee exists.
     */
    async findEmployee(
        employeeId: string
    ) {
        return prisma.employees.findUnique({
            where: {
                employee_id:
                    employeeId,
            },
        });
    }

    /**
     * Check whether a branch exists.
     */
    async findBranch(
        branchId: string
    ) {
        return prisma.branch.findUnique({
            where: {
                branch_id:
                    branchId,
            },
        });
    }

    /**
     * Check whether the doctor is assigned to the branch.
     */
    async findDoctorBranchMapping(
        employeeId: string,
        branchId: string
    ) {
        return prisma.user_branch_mapping.findFirst({
            where: {
                employee_id:
                    employeeId,

                branch_id:
                    branchId,
            },
        });
    }

    /**
     * Get the doctor's normal weekly schedules
     * for a specific branch and day.
     */
    async findDoctorSchedules(
        employeeId: string,
        branchId: string,
        dayOfWeek: string
    ) {
        return prisma.doctor_schedule.findMany({
            where: {
                employee_id:
                    employeeId,

                branch_id:
                    branchId,

                day_of_week:
                    dayOfWeek,

                is_active:
                    true,
            },

            orderBy: {
                start_time:
                    "asc",
            },
        });
    }
}

export const doctorScheduleRepository =
    new DoctorScheduleRepository();