import { DoctorScheduleChangeMode, Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { DoctorTransferRepository } from "../doctor-transfer/doctorTransfer.repository";

import {
    CreateDoctorScheduleChangePayload,
    UpdateDoctorScheduleChangePayload,
    ToggleRecurringSchedulePayload,
    CreateRecurringSlotPayload,
    UpdateRecurringSlotPayload,
} from "./doctor-schedule.types";

export class DoctorScheduleService {

    /**
     * Create ADD / OVERRIDE / CANCEL schedule change.
     *
     * Rules:
     *
     * ADD:
     *   - start_time and end_time are required
     *   - Multiple ADD records are allowed on the same date
     *
     * OVERRIDE:
     *   - start_time and end_time are required
     *   - Only one active OVERRIDE is allowed for a
     *     doctor + branch + date
     *
     * CANCEL:
     *   - start_time and end_time must be empty
     *   - Only one active CANCEL is allowed for a
     *     doctor + branch + date
     */
    async createScheduleChange(
        payload: CreateDoctorScheduleChangePayload,
        bypassPending: boolean = false
    ) {

        const {
            employee_id,
            branch_id,
            change_date,
            mode,
            start_time,
            end_time,
            reason,
            created_by,
        } = payload;

        // --------------------------------------------------
        // 1. Validate required fields
        // --------------------------------------------------

        if (!employee_id) {
            throw new Error(
                "employee_id is required"
            );
        }

        if (!branch_id) {
            throw new Error(
                "branch_id is required"
            );
        }

        if (!change_date) {
            throw new Error(
                "change_date is required"
            );
        }

        if (!mode) {
            throw new Error(
                "mode is required"
            );
        }

        // --------------------------------------------------
        // 2. Validate doctor
        // --------------------------------------------------

        const employee =
            await prisma.employees.findUnique({
                where: {
                    employee_id,
                },

                include: {
                    user_table: {
                        select: {
                            role_type: true,
                            user_status: true,
                        },
                    },
                },
            });

        if (!employee) {
            throw new Error(
                "Doctor not found"
            );
        }

        if (
            employee.user_table?.role_type &&
            employee.user_table.role_type !== "DOCTOR"
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

        // --------------------------------------------------
        // 3. Validate branch
        // --------------------------------------------------

        const branch =
            await prisma.branch.findUnique({
                where: {
                    branch_id,
                },
            });

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

        // --------------------------------------------------
        // 4. Validate doctor branch mapping
        // --------------------------------------------------

        const mapping =
            await prisma.user_branch_mapping.findFirst({
                where: {
                    employee_id,
                    branch_id,
                    status: 1,
                },
        });

        if (!mapping) {
            throw new Error(
                "Doctor is not assigned to the selected branch"
            );
        }
        if (!bypassPending) {
            const pendingRepo = new DoctorTransferRepository();
            const pending = await pendingRepo.findPendingTransfer(employee_id);
            if (pending) {
                throw new Error(`Doctor already has transfer ${pending.transfer_id} awaiting confirmation — complete or discard it before starting a new one`);
            }
        }
        
        // --------------------------------------------------
        // 5. Validate mode
        // --------------------------------------------------

        if (
            mode !== "ADD" &&
            mode !== "OVERRIDE" &&
            mode !== "CANCEL"
        ) {
            throw new Error(
                "Invalid schedule change mode"
            );
        }

        // --------------------------------------------------
        // 6. Validate date
        // --------------------------------------------------

        const parsedDate =
            this.parseDateOnly(
                change_date
            );

        // --------------------------------------------------
        // 7. Validate ADD / OVERRIDE
        // --------------------------------------------------

        if (
            mode === "ADD" ||
            mode === "OVERRIDE"
        ) {

            if (
                !start_time ||
                !end_time
            ) {
                throw new Error(
                    `${mode} requires start_time and end_time`
                );
            }

            this.validateTimeString(
                start_time,
                "start_time"
            );

            this.validateTimeString(
                end_time,
                "end_time"
            );

            if (
                this.timeToMinutes(
                    start_time
                ) >=
                this.timeToMinutes(
                    end_time
                )
            ) {
                throw new Error(
                    "start_time must be earlier than end_time"
                );
            }
        }

        // --------------------------------------------------
        // 8. Validate CANCEL
        // --------------------------------------------------

        if (
            mode === "CANCEL"
        ) {

            if (
                start_time !== undefined &&
                start_time !== null &&
                start_time !== ""
            ) {
                throw new Error(
                    "CANCEL should not contain start_time"
                );
            }

            if (
                end_time !== undefined &&
                end_time !== null &&
                end_time !== ""
            ) {
                throw new Error(
                    "CANCEL should not contain end_time"
                );
            }
        }

        // --------------------------------------------------
        // 9. Check existing active changes
        // --------------------------------------------------

        if (
            mode !== "ADD"
        ) {

            const existingChange =
                await prisma.doctor_schedule_change.findFirst({
                    where: {
                        employee_id,
                        branch_id,
                        change_date:
                            parsedDate,
                        is_active:
                            true,
                    },
                });

            if (existingChange) {

                throw new Error(
                    `An active ${existingChange.mode} schedule change already exists for this doctor, branch and date`
                );
            }
        }

        // --------------------------------------------------
        // 10. Prevent overlapping ADD / OVERRIDE ranges
        //
        // Compared against every active ADD or OVERRIDE change for this
        // doctor on the same date across ALL branches - a doctor cannot be
        // double-booked anywhere on that day, regardless of branch.
        // --------------------------------------------------

        if (
            (
                mode === "ADD" ||
                mode === "OVERRIDE"
            ) &&
            start_time &&
            end_time
        ) {

            const existingRanges =
                await prisma.doctor_schedule_change.findMany({
                    where: {
                        employee_id,
                        change_date:
                            parsedDate,
                        mode: {
                            in: [
                                "ADD",
                                "OVERRIDE"
                            ]
                        },
                        is_active:
                            true,
                    },

                    select: {
                        branch_id:
                            true,

                        mode: true,

                        start_time:
                            true,

                        end_time:
                            true,
                    },
                });

            const newStart =
                this.timeToMinutes(
                    start_time
                );

            const newEnd =
                this.timeToMinutes(
                    end_time
                );

            const formatMinutes = (value: number) =>
                `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

            for (
                const existing
                of existingRanges
            ) {

                if (
                    !existing.start_time ||
                    !existing.end_time
                ) {
                    continue;
                }

                const existingStart =
                    this.dateToMinutes(
                        existing.start_time
                    );

                const existingEnd =
                    this.dateToMinutes(
                        existing.end_time
                    );

                const overlaps =
                    newStart <
                        existingEnd &&
                    newEnd >
                        existingStart;

                if (overlaps) {
                    throw new Error(
                        `The ${mode} schedule overlaps an existing ${existing.mode} change ` +
                            `(${formatMinutes(existingStart)}-${formatMinutes(existingEnd)}) at branch ${existing.branch_id}`
                    );
                }
            }
        }

        // --------------------------------------------------
        // 10b. ADD must not overlap the recurring template
        //
        // An ADD is an EXTRA slot for one date - it has to
        // respect the same no-double-booking rule as a
        // recurring slot, checked across ALL branches.
        // OVERRIDE is deliberately exempt: replacing the
        // day's normal hours is its entire purpose.
        // --------------------------------------------------

        if (
            mode === "ADD" &&
            start_time &&
            end_time
        ) {

            const weekdayNames = [
                "SUNDAY",
                "MONDAY",
                "TUESDAY",
                "WEDNESDAY",
                "THURSDAY",
                "FRIDAY",
                "SATURDAY",
            ];

            const weekday =
                weekdayNames[parsedDate.getDay()];

            const templateSlots =
                await prisma.doctor_schedule.findMany({
                    where: {
                        employee_id,
                        day_of_week: {
                            equals: weekday,
                            mode: "insensitive",
                        },
                        is_active: true,
                    },

                    select: {
                        branch_id: true,
                        start_time: true,
                        end_time: true,
                    },
                });

            const addStart =
                this.timeToMinutes(start_time);

            const addEnd =
                this.timeToMinutes(end_time);

            const formatSlotMinutes = (value: number) =>
                `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

            for (
                const slot of templateSlots
            ) {

                if (
                    !slot.start_time ||
                    !slot.end_time
                ) {
                    continue;
                }

                const slotStart =
                    this.dateToMinutes(
                        slot.start_time
                    );

                const slotEnd =
                    this.dateToMinutes(
                        slot.end_time
                    );

                const overlaps =
                    addStart < slotEnd &&
                    addEnd > slotStart;

                if (overlaps) {
                    throw new Error(
                        `The ADD slot overlaps the recurring ${weekday} slot ` +
                            `(${formatSlotMinutes(slotStart)}-${formatSlotMinutes(slotEnd)}) at branch ${slot.branch_id}. ` +
                            `Use OVERRIDE if you intend to replace that day's hours.`
                    );
                }
            }
        }

        // --------------------------------------------------
        // 11. Convert time strings to Date
        // --------------------------------------------------

        const startTimeDate =
            start_time
                ? this.timeStringToDate(
                    start_time
                )
                : null;

        const endTimeDate =
            end_time
                ? this.timeStringToDate(
                    end_time
                )
                : null;

        // --------------------------------------------------
        // 12. Create schedule change
        // --------------------------------------------------

        return prisma.doctor_schedule_change.create({
            data: {
                employee_id:

                    employee_id,

                branch_id:

                    branch_id,

                change_date:

                    parsedDate,

                mode:

                    mode as DoctorScheduleChangeMode,

                start_time:

                    startTimeDate,

                end_time:

                    endTimeDate,

                reason:

                    reason?.trim() ||
                    null,

                is_active:

                    true,

                created_by:

                    created_by?.trim() ||
                    null,

                /**
                 * Prisma schema requires updated_at.
                 */
                updated_at:

                    new Date(),
            },
        });
    }

    /**
     * Update an existing schedule change.
     */
    async updateScheduleChange(
        change_id: bigint,
        payload: UpdateDoctorScheduleChangePayload
    ) {

        // --------------------------------------------------
        // 1. Find existing change
        // --------------------------------------------------

        const existingChange =
            await prisma.doctor_schedule_change.findUnique({
                where: {
                    change_id,
                },
            });

        if (!existingChange) {
            throw new Error(
                "Schedule change not found"
            );
        }

        if (
            !existingChange.is_active
        ) {
            throw new Error(
                "Cannot update an inactive schedule change"
            );
        }

        // --------------------------------------------------
        // 2. Determine final values
        // --------------------------------------------------

        const finalMode =
            payload.mode ??
            existingChange.mode;

        let finalChangeDate =
            existingChange.change_date;

        if (
            payload.change_date !== undefined
        ) {

            finalChangeDate =
                this.parseDateOnly(
                    payload.change_date
                );
        }

        const finalStartTime =
            payload.start_time !== undefined
                ? payload.start_time
                : existingChange.start_time
                    ? this.formatTime(
                        existingChange.start_time
                    )
                    : undefined;

        const finalEndTime =
            payload.end_time !== undefined
                ? payload.end_time
                : existingChange.end_time
                    ? this.formatTime(
                        existingChange.end_time
                    )
                    : undefined;

        // --------------------------------------------------
        // 3. Validate mode
        // --------------------------------------------------

        if (
            finalMode !== "ADD" &&
            finalMode !== "OVERRIDE" &&
            finalMode !== "CANCEL"
        ) {
            throw new Error(
                "Invalid schedule change mode"
            );
        }

        // --------------------------------------------------
        // 4. Validate ADD / OVERRIDE
        // --------------------------------------------------

        if (
            finalMode === "ADD" ||
            finalMode === "OVERRIDE"
        ) {

            if (
                !finalStartTime ||
                !finalEndTime
            ) {
                throw new Error(
                    `${finalMode} requires start_time and end_time`
                );
            }

            this.validateTimeString(
                finalStartTime,
                "start_time"
            );

            this.validateTimeString(
                finalEndTime,
                "end_time"
            );

            if (
                this.timeToMinutes(
                    finalStartTime
                ) >=
                this.timeToMinutes(
                    finalEndTime
                )
            ) {
                throw new Error(
                    "start_time must be earlier than end_time"
                );
            }
        }

        // --------------------------------------------------
        // 5. Validate CANCEL
        // --------------------------------------------------

        if (
            finalMode === "CANCEL"
        ) {

            if (
                payload.start_time !== undefined &&
                payload.start_time !== ""
            ) {
                throw new Error(
                    "CANCEL should not contain start_time"
                );
            }

            if (
                payload.end_time !== undefined &&
                payload.end_time !== ""
            ) {
                throw new Error(
                    "CANCEL should not contain end_time"
                );
            }
        }

        // --------------------------------------------------
        // 6. Prevent OVERRIDE / CANCEL conflicts
        // --------------------------------------------------

        if (
            finalMode !== "ADD"
        ) {

            const duplicate =
                await prisma.doctor_schedule_change.findFirst({
                    where: {
                        employee_id:
                            existingChange.employee_id,

                        branch_id:
                            existingChange.branch_id,

                        change_date:
                            finalChangeDate,

                        is_active:
                            true,

                        mode: {
                            in: [
                                "OVERRIDE",
                                "CANCEL",
                            ],
                        },

                        NOT: {
                            change_id,
                        },
                    },
                });

            if (duplicate) {
                throw new Error(
                    `An active ${duplicate.mode} schedule change already exists for this doctor, branch and date`
                );
            }
        }

        // --------------------------------------------------
        // 7. Prevent overlapping ADD / OVERRIDE ranges
        //
        // Same rule as on create: compare against every active ADD or
        // OVERRIDE for this doctor on the same date across ALL branches.
        // This change itself is excluded so editing a range in place never
        // false-positives against its own row.
        // --------------------------------------------------

        if (
            (
                finalMode === "ADD" ||
                finalMode === "OVERRIDE"
            ) &&
            finalStartTime &&
            finalEndTime
        ) {

            const existingRanges =
                await prisma.doctor_schedule_change.findMany({
                    where: {
                        employee_id:
                            existingChange.employee_id,

                        change_date:
                            finalChangeDate,

                        mode: {
                            in: [
                                "ADD",
                                "OVERRIDE"
                            ]
                        },

                        is_active:
                            true,

                        NOT: {
                            change_id,
                        },
                    },

                    select: {
                        branch_id:
                            true,

                        mode: true,

                        start_time:
                            true,

                        end_time:
                            true,
                    },
                });

            const newStart =
                this.timeToMinutes(
                    finalStartTime
                );

            const newEnd =
                this.timeToMinutes(
                    finalEndTime
                );

            const formatMinutes = (value: number) =>
                `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

            for (
                const existing
                of existingRanges
            ) {

                if (
                    !existing.start_time ||
                    !existing.end_time
                ) {
                    continue;
                }

                const existingStart =
                    this.dateToMinutes(
                        existing.start_time
                    );

                const existingEnd =
                    this.dateToMinutes(
                        existing.end_time
                    );

                const overlaps =
                    newStart <
                        existingEnd &&
                    newEnd >
                        existingStart;

                if (overlaps) {
                    throw new Error(
                        `The ${finalMode} schedule overlaps an existing ${existing.mode} change ` +
                            `(${formatMinutes(existingStart)}-${formatMinutes(existingEnd)}) at branch ${existing.branch_id}`
                    );
                }
            }
        }

        // --------------------------------------------------
        // 8. Build update data
        // --------------------------------------------------

        const updateData: {
            change_date?: Date;
            mode?: DoctorScheduleChangeMode;
            start_time?: Date | null;
            end_time?: Date | null;
            reason?: string | null;
            is_active?: boolean;
            updated_at?: Date;
        } = {};

        if (
            payload.change_date !== undefined
        ) {

            updateData.change_date =
                finalChangeDate;
        }

        if (
            payload.mode !== undefined
        ) {

            updateData.mode =
                payload.mode as DoctorScheduleChangeMode;
        }

        if (
            payload.start_time !== undefined
        ) {

            updateData.start_time =
                payload.start_time
                    ? this.timeStringToDate(
                        payload.start_time
                    )
                    : null;
        }

        if (
            payload.end_time !== undefined
        ) {

            updateData.end_time =
                payload.end_time
                    ? this.timeStringToDate(
                        payload.end_time
                    )
                    : null;
        }

        if (
            payload.reason !== undefined
        ) {

            updateData.reason =
                payload.reason?.trim() ||
                null;
        }

        if (
            payload.is_active !== undefined
        ) {

            updateData.is_active =
                payload.is_active;
        }

        // --------------------------------------------------
        // 9. If changing to CANCEL, clear times
        // --------------------------------------------------

        if (
            finalMode === "CANCEL"
        ) {

            updateData.start_time =
                null;

            updateData.end_time =
                null;
        }

        // --------------------------------------------------
        // 10. Always update updated_at
        // --------------------------------------------------

        updateData.updated_at =
            new Date();

        // --------------------------------------------------
        // 11. Update
        // --------------------------------------------------

        return prisma.doctor_schedule_change.update({
            where: {
                change_id,
            },

            data:
                updateData,
        });
    }

    /**
     * Get all active schedule changes for a doctor.
     */
    async getDoctorScheduleChanges(
        employee_id: string
    ) {

        if (!employee_id) {
            throw new Error(
                "employee_id is required"
            );
        }

        return prisma.doctor_schedule_change.findMany({
            where: {
                employee_id,

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
     * Get schedule changes for a doctor
     * on a specific date.
     */
    async getScheduleChangesByDate(
        employee_id: string,
        change_date: string
    ) {

        if (!employee_id) {
            throw new Error(
                "employee_id is required"
            );
        }

        const parsedDate =
            this.parseDateOnly(
                change_date
            );

        return prisma.doctor_schedule_change.findMany({
            where: {
                employee_id,

                change_date:
                    parsedDate,

                is_active:
                    true,
            },

            orderBy: [
                {
                    created_at:
                        "asc",
                },
            ],
        });
    }

    /**
     * Deactivate a schedule change.
     *
     * This does NOT delete the database record.
     * It sets is_active = false.
     */
    async cancelScheduleChange(
        change_id: bigint
    ) {

        const existingChange =
            await prisma.doctor_schedule_change.findUnique({
                where: {
                    change_id,
                },
            });

        if (!existingChange) {
            throw new Error(
                "Schedule change not found"
            );
        }

        if (!existingChange.is_active) {
            throw new Error(
                "Schedule change is already inactive"
            );
        }

        return prisma.doctor_schedule_change.update({
            where: {
                change_id,
            },

            data: {
                is_active:
                    false,

                updated_at:
                    new Date(),
            },
        });
    }

    // ==================================================
    // Helper methods
    // ==================================================

    /**
     * Parse a YYYY-MM-DD date and normalize it
     * to UTC midnight.
     */
    private parseDateOnly(
        value: string
    ): Date {

        if (!value) {
            throw new Error(
                "Date is required"
            );
        }

        const match =
            /^(\d{4})-(\d{2})-(\d{2})$/.exec(
                value
            );

        if (!match) {
            throw new Error(
                "Invalid date. Expected format YYYY-MM-DD"
            );
        }

        const year =
            Number(match[1]);

        const month =
            Number(match[2]);

        const day =
            Number(match[3]);

        const date =
            new Date(
                Date.UTC(
                    year,
                    month - 1,
                    day
                )
            );

        if (
            date.getUTCFullYear() !==
                year ||
            date.getUTCMonth() !==
                month - 1 ||
            date.getUTCDate() !==
                day
        ) {
            throw new Error(
                "Invalid date"
            );
        }

        return date;
    }

    /**
     * Convert HH:mm or HH:mm:ss to minutes.
     */
    private timeToMinutes(
        value: string
    ): number {

        const match =
            /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
                value
            );

        if (!match) {
            throw new Error(
                "Invalid time. Expected format HH:mm or HH:mm:ss"
            );
        }

        const hours =
            Number(match[1]);

        const minutes =
            Number(match[2]);

        const seconds =
            match[3]
                ? Number(match[3])
                : 0;

        if (
            hours < 0 ||
            hours > 23 ||
            minutes < 0 ||
            minutes > 59 ||
            seconds < 0 ||
            seconds > 59
        ) {
            throw new Error(
                "Invalid time"
            );
        }

        return (
            hours * 60 +
            minutes
        );
    }

    /**
     * Validate a time string.
     */
    private validateTimeString(
        value: string,
        fieldName: string
    ): void {

        try {
            this.timeToMinutes(
                value
            );
        } catch {
            throw new Error(
                `${fieldName} must be in HH:mm or HH:mm:ss format`
            );
        }
    }

    /**
     * Convert HH:mm / HH:mm:ss to a Date
     * suitable for PostgreSQL TIME.
     */
    private timeStringToDate(
        value: string
    ): Date {

        this.validateTimeString(
            value,
            "time"
        );

        const [
            hours,
            minutes,
            seconds = "0",
        ] =
            value.split(":");

        const result =
            new Date(0);

        result.setUTCHours(
            Number(hours),
            Number(minutes),
            Number(seconds),
            0
        );

        return result;
    }

    /**
     * Convert PostgreSQL TIME Date
     * into minutes since midnight.
     */
    private dateToMinutes(
        value: Date
    ): number {

        return (
            value.getUTCHours() * 60 +
            value.getUTCMinutes()
        );
    }

    /**
     * Convert PostgreSQL TIME Date
     * into HH:mm string.
     */
    private formatTime(
        value: Date
    ): string {

        const hours =
            value
                .getUTCHours()
                .toString()
                .padStart(2, "0");

        const minutes =
            value
                .getUTCMinutes()
                .toString()
                .padStart(2, "0");

        return `${hours}:${minutes}`;
    }

    /**
     * Get all recurring weekly schedules for a doctor.
     *
     * Includes inactive rows so the frontend can tell
     * whether a day was toggled off versus never having
     * a schedule at all.
     */
    async getRecurringSchedules(
        employee_id: string,
        branch_id?: string
    ) {
        if (!employee_id) {
            throw new Error(
                "employee_id is required"
            );
        }

        return prisma.doctor_schedule.findMany({
            where: {
                employee_id,
                ...(branch_id
                    ? { branch_id }
                    : {}),
            },
            orderBy: {
                day_of_week: "asc",
            },
        });
    }

    /**
     * PATCH
     * Toggle the recurring weekly schedule for a
     * doctor + branch + day_of_week on/off.
     *
     * This edits the real weekly template
     * (doctor_schedule.is_active), so the change is
     * visible to every consumer of the schedule, not
     * just this page, and it applies for every future
     * week until toggled back on.
     */
    async toggleRecurringDay(
        payload: ToggleRecurringSchedulePayload
    ) {
        const {
            employee_id,
            branch_id,
            day_of_week,
            is_active,
        } = payload;

        if (!employee_id) {
            throw new Error(
                "employee_id is required"
            );
        }

        if (!branch_id) {
            throw new Error(
                "branch_id is required"
            );
        }

        if (!day_of_week) {
            throw new Error(
                "day_of_week is required"
            );
        }

        if (
            typeof is_active !== "boolean"
        ) {
            throw new Error(
                "is_active is required"
            );
        }

        const normalizedDay =
            day_of_week.trim().toUpperCase();

        const validDays = [
            "MONDAY",
            "TUESDAY",
            "WEDNESDAY",
            "THURSDAY",
            "FRIDAY",
            "SATURDAY",
            "SUNDAY",
        ];

        if (
            !validDays.includes(normalizedDay)
        ) {
            throw new Error(
                "Invalid day_of_week"
            );
        }

        // Validate doctor
        const employee =
            await prisma.employees.findUnique({
                where: {
                    employee_id,
                },

                include: {
                    user_table: {
                        select: {
                            role_type: true,
                            user_status: true,
                        },
                    },
                },
            });

        if (!employee) {
            throw new Error(
                "Doctor not found"
            );
        }

        if (
            employee.user_table?.role_type &&
            employee.user_table.role_type !== "DOCTOR"
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

        // Validate branch
        const branch =
            await prisma.branch.findUnique({
                where: {
                    branch_id,
                },
            });

        if (!branch) {
            throw new Error(
                "Branch not found"
            );
        }

        if (
            branch.branch_status !== "Active"
        ) {
            throw new Error(
                "Selected branch is inactive"
            );
        }

        // Validate doctor branch mapping
        const mapping =
            await prisma.user_branch_mapping.findFirst({
                where: {
                    employee_id,
                    branch_id,
                    status: 1,
                },
            });

        if (!mapping) {
            throw new Error(
                "Doctor is not assigned to the selected branch"
            );
        }

        const result =
            await prisma.doctor_schedule.updateMany({
                where: {
                    employee_id,
                    branch_id,
                    day_of_week: {
                        equals: normalizedDay,
                        mode: "insensitive",
                    },
                },
                data: {
                    is_active,
                },
            });

        return {
            updated_count: result.count,
            is_active,
        };
    }

    /**
     * POST /recurring/slot
     * Add a single recurring slot to the doctor_schedule template.
     *
     * The row is keyed by employee + branch + day_of_week and stored with
     * is_active = true, so it applies to every upcoming occurrence of that
     * weekday -- NOT a date-specific doctor_schedule_change.
     */
    async createRecurringSlot(
        payload: CreateRecurringSlotPayload
    ) {
        const {
            employee_id,
            branch_id,
            day_of_week,
            shift_name,
            start_time,
            end_time,
            consultation_minutes,
        } = payload;

        if (!employee_id) {
            throw new Error(
                "employee_id is required"
            );
        }

        if (!branch_id) {
            throw new Error(
                "branch_id is required"
            );
        }

        if (!day_of_week) {
            throw new Error(
                "day_of_week is required"
            );
        }

        if (!start_time || !end_time) {
            throw new Error(
                "start_time and end_time are required"
            );
        }

        // Validate doctor
        const employee =
            await prisma.employees.findUnique({
                where: {
                    employee_id,
                },

                include: {
                    user_table: {
                        select: {
                            role_type: true,
                            user_status: true,
                        },
                    },
                },
            });

        if (!employee) {
            throw new Error(
                "Doctor not found"
            );
        }

        if (
            employee.user_table?.role_type &&
            employee.user_table.role_type !== "DOCTOR"
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

        // Validate branch
        const branch =
            await prisma.branch.findUnique({
                where: {
                    branch_id,
                },
            });

        if (!branch) {
            throw new Error(
                "Branch not found"
            );
        }

        if (
            branch.branch_status !== "Active"
        ) {
            throw new Error(
                "Selected branch is inactive"
            );
        }

        // Validate doctor branch mapping
        const mapping =
            await prisma.user_branch_mapping.findFirst({
                where: {
                    employee_id,
                    branch_id,
                    status: 1,
                },
            });

        if (!mapping) {
            throw new Error(
                "Doctor is not assigned to the selected branch"
            );
        }

        // Validate day_of_week
        const normalizedDay =
            day_of_week.trim().toUpperCase();

        const validDays = [
            "MONDAY",
            "TUESDAY",
            "WEDNESDAY",
            "THURSDAY",
            "FRIDAY",
            "SATURDAY",
            "SUNDAY",
        ];

        if (
            !validDays.includes(normalizedDay)
        ) {
            throw new Error(
                "Invalid day_of_week"
            );
        }

        // Validate times
        this.validateTimeString(
            start_time,
            "start_time"
        );

        this.validateTimeString(
            end_time,
            "end_time"
        );

        if (
            this.timeToMinutes(start_time) >=
            this.timeToMinutes(end_time)
        ) {
            throw new Error(
                "start_time must be earlier than end_time"
            );
        }

        // Reject overlap with existing active slots on the same day.
        // Scoped to the DOCTOR across ALL branches - a doctor cannot be
        // in two slots at once, no matter which branch each row belongs to.
        const existingActive =
            await prisma.doctor_schedule.findMany({
                where: {
                    employee_id,
                    day_of_week: {
                        equals: normalizedDay,
                        mode: "insensitive",
                    },
                    is_active: true,
                },

                select: {
                    branch_id: true,
                    start_time: true,
                    end_time: true,
                },
            });

        const newStart =
            this.timeToMinutes(start_time);

        const newEnd =
            this.timeToMinutes(end_time);

        for (const existing of existingActive) {
            if (
                !existing.start_time ||
                !existing.end_time
            ) {
                continue;
            }

            const existingStart =
                this.dateToMinutes(
                    existing.start_time
                );

            const existingEnd =
                this.dateToMinutes(
                    existing.end_time
                );

            const overlaps =
                newStart < existingEnd &&
                newEnd > existingStart;

            if (overlaps) {
                throw new Error(
                    `The new slot overlaps with an existing active slot on the same day (${existing.branch_id})`
                );
            }
        }

        // Create the recurring slot
        return prisma.doctor_schedule.create({
            data: {
                employee_id,
                branch_id,
                day_of_week: normalizedDay,
                shift_name:
                    shift_name?.trim() || null,
                start_time:
                    this.timeStringToDate(
                        start_time
                    ),
                end_time:
                    this.timeStringToDate(
                        end_time
                    ),
                consultation_minutes: consultation_minutes ?? 20,
                is_active: true,
                effective_from: new Date(),
            },
        });
    }

    /**
     * PUT /recurring/slot
     * Update a single recurring slot in the
     * doctor_schedule template.
     */
    async updateRecurringSlot(
        schedule_id: bigint,
        employee_id: string,
        payload: UpdateRecurringSlotPayload
    ) {
        const {
            branch_id,
            day_of_week,
            shift_name,
            start_time,
            end_time,
            consultation_minutes,
        } = payload;

        if (!employee_id) {
            throw new Error(
                "employee_id is required"
            );
        }

        if (!branch_id) {
            throw new Error(
                "branch_id is required"
            );
        }

        if (!day_of_week) {
            throw new Error(
                "day_of_week is required"
            );
        }

        if (!start_time || !end_time) {
            throw new Error(
                "start_time and end_time are required"
            );
        }

        // Validate doctor
        const employee =
            await prisma.employees.findUnique({
                where: {
                    employee_id,
                },

                include: {
                    user_table: {
                        select: {
                            role_type: true,
                            user_status: true,
                        },
                    },
                },
            });

        if (!employee) {
            throw new Error(
                "Doctor not found"
            );
        }

        if (
            employee.user_table?.role_type &&
            employee.user_table.role_type !== "DOCTOR"
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

        // Validate branch
        const branch =
            await prisma.branch.findUnique({
                where: {
                    branch_id,
                },
            });

        if (!branch) {
            throw new Error(
                "Branch not found"
            );
        }

        if (
            branch.branch_status !== "Active"
        ) {
            throw new Error(
                "Selected branch is inactive"
            );
        }

        // Validate doctor branch mapping
        const mapping =
            await prisma.user_branch_mapping.findFirst({
                where: {
                    employee_id,
                    branch_id,
                    status: 1,
                },
            });

        if (!mapping) {
            throw new Error(
                "Doctor is not assigned to the selected branch"
            );
        }

        // Validate day_of_week
        const normalizedDay =
            day_of_week.trim().toUpperCase();

        const validDays = [
            "MONDAY",
            "TUESDAY",
            "WEDNESDAY",
            "THURSDAY",
            "FRIDAY",
            "SATURDAY",
            "SUNDAY",
        ];

        if (
            !validDays.includes(normalizedDay)
        ) {
            throw new Error(
                "Invalid day_of_week"
            );
        }

        // Validate times
        this.validateTimeString(
            start_time,
            "start_time"
        );

        this.validateTimeString(
            end_time,
            "end_time"
        );

        if (
            this.timeToMinutes(start_time) >=
            this.timeToMinutes(end_time)
        ) {
            throw new Error(
                "start_time must be earlier than end_time"
            );
        }

        // Load the slot being updated and make sure it
        // belongs to the doctor and is still active.
        const existingSlot =
            await prisma.doctor_schedule.findUnique({
                where: {
                    schedule_id,
                },
            });

        if (!existingSlot) {
            throw new Error(
                "Schedule slot not found"
            );
        }

        if (
            existingSlot.employee_id !== employee_id
        ) {
            throw new Error(
                "Schedule does not belong to the specified employee"
            );
        }

        if (
            existingSlot.is_active !== true
        ) {
            throw new Error(
                "Schedule slot is inactive and cannot be updated"
            );
        }

        // Reject overlap with other active slots on the
        // same day - this slot itself is excluded so
        // editing its times in place never false-positives
        // against its own row. Scoped to the DOCTOR across
        // ALL branches, matching addRecurringSlot.
        const newStart =
            this.timeToMinutes(start_time);

        const newEnd =
            this.timeToMinutes(end_time);

        const existingActive =
            await prisma.doctor_schedule.findMany({
                where: {
                    employee_id,
                    day_of_week: {
                        equals: normalizedDay,
                        mode: "insensitive",
                    },
                    is_active: true,
                    schedule_id: {
                        not: schedule_id,
                    },
                },

                select: {
                    branch_id: true,
                    start_time: true,
                    end_time: true,
                },
            });

        for (const existing of existingActive) {
            if (
                !existing.start_time ||
                !existing.end_time
            ) {
                continue;
            }

            const existingStart =
                this.dateToMinutes(
                    existing.start_time
                );

            const existingEnd =
                this.dateToMinutes(
                    existing.end_time
                );

            const overlaps =
                newStart < existingEnd &&
                newEnd > existingStart;

            if (overlaps) {
                throw new Error(
                    "The updated slot overlaps with an existing active slot on the same day"
                );
            }
        }

        // Apply the update
        return prisma.doctor_schedule.update({
            where: {
                schedule_id,
            },
            data: {
                branch_id,
                day_of_week: normalizedDay,
                shift_name:
                    shift_name?.trim() || null,
                start_time:
                    this.timeStringToDate(
                        start_time
                    ),
                end_time:
                    this.timeStringToDate(
                        end_time
                    ),
                consultation_minutes: consultation_minutes ?? undefined,
            },
        });
    }

    /**
     * DELETE /recurring/slot
     * Soft-close a single recurring slot in the
     * doctor_schedule template.
     */
    async deleteRecurringSlot(
        schedule_id: bigint,
        employee_id: string,
        actingUserId: string
    ) {
        if (!employee_id) {
            throw new Error(
                "employee_id is required"
            );
        }

        const schedule =
            await prisma.doctor_schedule.findUnique({
                where: {
                    schedule_id,
                },
            });

        if (!schedule) {
            throw new Error(
                "Schedule not found"
            );
        }

        if (
            schedule.employee_id !== employee_id
        ) {
            throw new Error(
                "Schedule does not belong to the specified employee"
            );
        }

        if (
            schedule.is_active === false
        ) {
            throw new Error(
                "Schedule is already inactive"
            );
        }

        return prisma.doctor_schedule.update({
            where: {
                schedule_id,
            },

            data: {
                is_active: false,
                effective_to: new Date(),
                deleted_by: actingUserId,
            },
        });
    }
    /**
     * Transaction-aware low-level appliers used by the transfer flow so a
     * confirmed DATE_CHANGE can be written inside confirmTransfer's own
     * transaction. Validation already happened at initiation time.
     */
    async applyCreateChangeTx(
        tx: Prisma.TransactionClient,
        data: {
            employee_id: string;
            branch_id: string;
            change_date: Date;
            mode: DoctorScheduleChangeMode;
            start_time: Date | null;
            end_time: Date | null;
            reason?: string | null;
            created_by?: string | null;
        }
    ) {
        return tx.doctor_schedule_change.create({
            data: {
                employee_id: data.employee_id,
                branch_id: data.branch_id,
                change_date: data.change_date,
                mode: data.mode,
                start_time: data.start_time,
                end_time: data.end_time,
                reason: data.reason ?? null,
                is_active: true,
                created_by: data.created_by ?? null,
                updated_at: new Date()
            }
        });
    }

    async applyUpdateChangeTx(
        tx: Prisma.TransactionClient,
        change_id: bigint,
        data: {
            mode?: DoctorScheduleChangeMode;
            start_time?: Date | null;
            end_time?: Date | null;
            reason?: string | null;
        }
    ) {
        return tx.doctor_schedule_change.update({
            where: { change_id },
            data: {
                ...(data.mode ? { mode: data.mode } : {}),
                ...(data.start_time !== undefined ? { start_time: data.start_time } : {}),
                ...(data.end_time !== undefined ? { end_time: data.end_time } : {}),
                ...(data.reason !== undefined ? { reason: data.reason } : {}),
                updated_at: new Date()
            }
        });
    }

    async applyDeactivateChangeTx(tx: Prisma.TransactionClient, change_id: bigint) {
        return tx.doctor_schedule_change.update({
            where: { change_id },
            data: { is_active: false, updated_at: new Date() }
        });
    }}

export const doctorScheduleService =
    new DoctorScheduleService();