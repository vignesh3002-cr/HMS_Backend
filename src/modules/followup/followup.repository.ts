import prisma from "../../config/prisma";

export class FollowupRepository {

    async findActiveBranchIdsForUser(userId: string): Promise<string[]> {
        const mappings = await prisma.user_branch_mapping.findMany({
            where: { user_id: userId, status: 1 },
            select: { branch_id: true }
        });
        return [...new Set(mappings.map((mapping) => String(mapping.branch_id)))];
    }

    /* Encounters visited in [from, before) that have a follow-up date, in the
       given branches (null = every branch), newest visit first. */
    async findEncountersWithFollowUp(from: Date, before: Date, branchIds: string[] | null) {
        return prisma.encounter.findMany({
            where: {
                follow_up_date: { not: null },
                encounter_ts: { gte: from, lt: before },
                ...(branchIds ? { branch_id: { in: branchIds } } : {})
            },
            orderBy: { encounter_ts: "desc" },
            select: {
                encounter_no: true,
                encounter_ts: true,
                follow_up_date: true,
                appointment_id: true,
                patient_id: true,
                branch_id: true,
                department_id: true,
                patient_bio_data: {
                    select: {
                        patient_id: true,
                        patient_first_name: true,
                        patient_middle_name: true,
                        patient_last_name: true,
                        patient_gender: true,
                        patient_age: true,
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
                branch: { select: { branch_id: true, branch_name: true } },
                department_master: { select: { department_id: true, department_name: true } }
            }
        });
    }

    /* The patients' appointments on or after a date, not cancelled / no-show. */
    async findLaterAppointments(patientIds: string[], fromDate: Date, excludedStatuses: string[]) {
        if (patientIds.length === 0) return [];
        return prisma.appointment_history.findMany({
            where: {
                patient_id: { in: patientIds },
                appointment_date: { gte: fromDate },
                OR: [{ status: null }, { status: { notIn: excludedStatuses } }]
            },
            orderBy: { appointment_date: "asc" },
            select: { appointment_id: true, patient_id: true, appointment_date: true, status: true }
        });
    }

    async findStates(userId: string, encounterNos: string[]) {
        if (encounterNos.length === 0) return [];
        return prisma.followup_alert_state.findMany({
            where: { user_id: userId, encounter_no: { in: encounterNos } }
        });
    }

    async upsertState(
        userId: string,
        encounterNo: string,
        followUpDate: Date,
        data: { read_at?: Date; dismissed_at?: Date }
    ) {
        return prisma.followup_alert_state.upsert({
            where: {
                user_id_encounter_no_follow_up_date: {
                    user_id: userId,
                    encounter_no: encounterNo,
                    follow_up_date: followUpDate
                }
            },
            update: data,
            create: { user_id: userId, encounter_no: encounterNo, follow_up_date: followUpDate, ...data }
        });
    }

}
