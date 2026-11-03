import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { generateId, generateIdBatch } from "../../utils/idGenerator";
import { GetPrescriptionsQuery } from "./prescription.types";

const prescriptionItemInclude = {
    medicine_master: {
        select: {
            medicine_id: true,
            medicine_code: true,
            medicine_name: true,
            generic_name: true,
            dosage_form: true,
            strength: true
        }
    }
};

const prescriptionDetailInclude = {
    patient_history: {
        select: {
            patient_history_id: true,
            appointment_id: true,
            visit_date: true,
            patient_bio_data: {
                select: {
                    patient_id: true,
                    patient_first_name: true,
                    patient_middle_name: true,
                    patient_last_name: true,
                    patient_gender: true,
                    patient_primary_mobile: true
                }
            }
        }
    },
    employees: {
        select: {
            employee_id: true,
            first_name: true,
            middle_name: true,
            last_name: true,
            specialization: true
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
    diagnosis: {
        select: {
            diagnosis_id: true,
            diagnosis_name: true,
            icd_code: true
        }
    },
    prescription_items: {
        include: prescriptionItemInclude
    }
};

const medicinePickerSelect = {
    medicine_id: true,
    medicine_name: true,
    generic_name: true,
    brand_name: true,
    strength: true,
    dosage_form: true,
    unit: true,
    route: true
};

function startOfDay(date: string): Date {
    return new Date(`${date}T00:00:00.000Z`);
}

function startOfNextDay(date: string): Date {
    const day = startOfDay(date);
    day.setUTCDate(day.getUTCDate() + 1);
    return day;
}

export class PrescriptionRepository {

    async findEncounterForPrescription(encounterNo: string) {

        return prisma.encounter.findUnique({
            where: { encounter_no: encounterNo },
            include: {
                patient_bio_data: {
                    select: {
                        patient_id: true,
                        patient_first_name: true,
                        patient_middle_name: true,
                        patient_last_name: true,
                        patient_gender: true,
                        patient_primary_mobile: true,
                        patient_email: true,
                        patient_type: true,
                        branch_id: true,
                    }
                },
                employees: {
                    select: {
                        employee_id: true,
                        user_id: true,
                        first_name: true,
                        middle_name: true,
                        last_name: true,
                        specialization: true,
                        designation: true,
                    }
                },
                branch: {
                    select: {
                        branch_id: true,
                        branch_name: true,
                        branch_area: true,
                    }
                },
                department_master: {
                    select: {
                        department_id: true,
                        department_name: true,
                    }
                }
            }
        });

    }

    async findDiagnosis(diagnosisId: string) {

        return prisma.diagnosis.findUnique({
            where: { diagnosis_id: diagnosisId }
        });

    }

    async findMedicine(medicineId: string) {

        return prisma.medicine_master.findUnique({
            where: { medicine_id: medicineId }
        });

    }

    async findMedicines(medicineIds: string[]) {

        if (medicineIds.length === 0) {
            return [];
        }

        return prisma.medicine_master.findMany({
            where: { medicine_id: { in: medicineIds } }
        });

    }

    // Medicine picker for OPD prescriptions. Every search word must match the
    // medicine, generic or brand name. Rows catalogued as "Instruction" are
    // protocol notes rather than drugs, so they are left out.
    async searchMedicines(words: string[], take: number) {

        return prisma.medicine_master.findMany({
            where: {
                is_active: true,
                AND: [
                    {
                        OR: [
                            { medicine_category: null },
                            { medicine_category: { not: "Instruction" } }
                        ]
                    },
                    ...words.map((word) => ({
                        OR: [
                            { medicine_name: { contains: word, mode: "insensitive" as const } },
                            { generic_name: { contains: word, mode: "insensitive" as const } },
                            { brand_name: { contains: word, mode: "insensitive" as const } }
                        ]
                    }))
                ]
            },
            select: medicinePickerSelect,
            orderBy: { medicine_name: "asc" },
            take
        });

    }

    async findMedicineByName(medicineName: string) {

        return prisma.medicine_master.findFirst({
            where: { medicine_name: { equals: medicineName, mode: "insensitive" } },
            select: medicinePickerSelect
        });

    }

    async findLastMedicineId() {

        const last = await prisma.medicine_master.findFirst({
            where: { medicine_id: { startsWith: "MED" } },
            orderBy: { medicine_id: "desc" },
            select: { medicine_id: true }
        });

        return last?.medicine_id ?? null;

    }

    async createMedicine(data: Prisma.medicine_masterUncheckedCreateInput) {

        return prisma.medicine_master.create({
            data,
            select: medicinePickerSelect
        });

    }

    // Resolve drug_role/drug_type for a set of medicine ids from the patient's
    // chemotherapy plan. Prefers the plan linked to the encounter, then falls
    // back to the patient's most recent active plan. When the visit has a
    // cycle-day order, its rows win so a drug that appears on another day with
    // another role cannot leak in. Returns a map keyed by medicine_id.
    async findDrugMetadata(
        encounterNo: string,
        patientId: string,
        medicineIds: (string | null | undefined)[]
    ) {

        const cleanIds = medicineIds.filter((id): id is string => typeof id === "string" && id.length > 0);

        if (cleanIds.length === 0) {
            return new Map<string, {
                drug_role?: string | null;
                drug_type?: string | null;
                chemotherapy_plan_id?: string | null;
                plan_order_id?: string | null;
                plan_item_id?: string | null;
                cycle_number?: number | null;
                cycle_day?: number | null;
            }>();
        }

        const planWhere: Prisma.chemotherapy_planWhereInput = {
            active_status: 1,
            chemotherapy_plan_items: {
                some: { medicine_id: { in: cleanIds } }
            }
        };

        const plan = await prisma.chemotherapy_plan.findFirst({
            where: { ...planWhere, encounter_no: encounterNo },
            orderBy: { created_at: "desc" }
        }) ?? await prisma.chemotherapy_plan.findFirst({
            where: { ...planWhere, patient_id: patientId },
            orderBy: { created_at: "desc" }
        });

        if (!plan) {
            return new Map();
        }

        const order = await prisma.chemotherapy_plan_order.findFirst({
            where: {
                chemotherapy_plan_id: plan.chemotherapy_plan_id,
                ...(encounterNo ? { encounter_no: encounterNo } : {})
            },
            orderBy: [{ cycle_number: "desc" }, { cycle_day: "desc" }]
        });

        const itemSelect = {
            medicine_id: true,
            drug_role: true,
            drug_type: true,
            chemotherapy_plan_item_id: true,
            plan_order_id: true,
            chemotherapy_plan_id: true,
            cycle_day: true
        };

        let planItems = order
            ? await prisma.chemotherapy_plan_items.findMany({
                where: {
                    chemotherapy_plan_id: plan.chemotherapy_plan_id,
                    active_status: 1,
                    medicine_id: { in: cleanIds },
                    plan_order_id: order.plan_order_id
                },
                select: itemSelect
            })
            : [];

        // Baseline plans (and items saved before cycle-day orders) have no
        // plan_order_id, so fall back to the plan-level rows.
        if (planItems.length === 0) {
            planItems = await prisma.chemotherapy_plan_items.findMany({
                where: {
                    chemotherapy_plan_id: plan.chemotherapy_plan_id,
                    active_status: 1,
                    medicine_id: { in: cleanIds }
                },
                select: itemSelect
            });
        }

        return new Map(
            planItems
                .filter((item): item is typeof item & { medicine_id: string } => Boolean(item.medicine_id))
                .map((item) => [
                    item.medicine_id,
                    {
                        drug_role: item.drug_role,
                        drug_type: item.drug_type,
                        chemotherapy_plan_id: item.chemotherapy_plan_id,
                        plan_order_id: item.plan_order_id ?? order?.plan_order_id ?? null,
                        plan_item_id: item.chemotherapy_plan_item_id,
                        cycle_number: order?.cycle_number ?? null,
                        cycle_day: item.cycle_day ?? order?.cycle_day ?? null
                    }
                ])
        );

    }

    // Authoritative plan-item rows for the items the client linked. Scoped to
    // the visit's plan (or the patient's plans) so a stray plan_item_id from
    // another patient cannot inject a drug role. This is the role source: the
    // plan item was copied from chemotherapy_regimen_protocol_items.
    async findPlanItemMetadata(
        planItemIds: string[],
        scope: { encounterNo?: string | null; patientId: string }
    ) {

        if (planItemIds.length === 0) {
            return new Map<string, {
                chemotherapy_plan_item_id: string;
                chemotherapy_plan_id: string;
                plan_order_id: string | null;
                drug_role: string;
                drug_type: string | null;
                cycle_day: number | null;
            }>();
        }

        const planScopes: Prisma.chemotherapy_planWhereInput[] = [
            { patient_id: scope.patientId }
        ];

        if (scope.encounterNo) {
            planScopes.push({ encounter_no: scope.encounterNo });
        }

        const rows = await prisma.chemotherapy_plan_items.findMany({
            where: {
                chemotherapy_plan_item_id: { in: planItemIds },
                active_status: 1,
                chemotherapy_plan: { OR: planScopes }
            },
            select: {
                chemotherapy_plan_item_id: true,
                chemotherapy_plan_id: true,
                plan_order_id: true,
                drug_role: true,
                drug_type: true,
                cycle_day: true
            }
        });

        return new Map(
            rows.map((row) => [row.chemotherapy_plan_item_id, row])
        );

    }

    async findPatientHistoryByAppointment(appointmentId: string) {

        return prisma.patient_history.findFirst({
            where: { appointment_id: appointmentId }
        });

    }

    // Resolve the visit's patient_history without ever creating a second row
    // for the same visit: appointment -> encounter -> the history its
    // chemotherapy plan points at -> the patient's most recent row (24h).
    // Legacy/imported rows can have appointment_id = NULL, which is exactly
    // the case that used to create duplicate histories.
    async findPatientHistoryForVisit(
        tx: Prisma.TransactionClient,
        visit: {
            patientId: string;
            appointmentId?: string | null;
            encounterNo?: string | null;
        }
    ) {

        if (visit.appointmentId) {

            const byAppointment = await tx.patient_history.findFirst({
                where: { appointment_id: visit.appointmentId }
            });

            if (byAppointment) {
                return byAppointment;
            }

        }

        if (visit.encounterNo) {

            const byEncounter = await tx.patient_history.findFirst({
                where: { encounter_no: visit.encounterNo },
                orderBy: { id: "desc" }
            });

            if (byEncounter) {
                return byEncounter;
            }

        }

        const visitScopes: Prisma.chemotherapy_planWhereInput[] = [];

        if (visit.encounterNo) {
            visitScopes.push({ encounter_no: visit.encounterNo });
        }

        if (visit.appointmentId) {
            visitScopes.push({ appointment_id: visit.appointmentId });
        }

        if (visitScopes.length > 0) {

            const plan = await tx.chemotherapy_plan.findFirst({
                where: {
                    patient_id: visit.patientId,
                    OR: visitScopes
                },
                orderBy: { created_at: "desc" },
                select: { patient_history_id: true }
            });

            if (plan?.patient_history_id) {

                const byPlan = await tx.patient_history.findUnique({
                    where: { patient_history_id: plan.patient_history_id }
                });

                if (byPlan) {
                    return byPlan;
                }

            }

        }

        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

        return tx.patient_history.findFirst({
            where: {
                patient_id: visit.patientId,
                updated_at: { gte: since }
            },
            orderBy: [{ updated_at: "desc" }, { id: "desc" }]
        });

    }

    async linkPatientHistoryToVisit(
        tx: Prisma.TransactionClient,
        history: {
            patient_history_id: string;
            appointment_id?: string | null;
            encounter_no?: string | null;
            branch_id?: string | null;
            department_id?: string | null;
        },
        visit: {
            appointmentId?: string | null;
            encounterNo?: string | null;
            branchId?: string | null;
            departmentId?: string | null;
        }
    ) {

        const data: Prisma.patient_historyUncheckedUpdateInput = {};

        if (visit.appointmentId && !history.appointment_id) {
            data.appointment_id = visit.appointmentId;
        }

        if (visit.encounterNo && !history.encounter_no) {
            data.encounter_no = visit.encounterNo;
        }

        if (visit.branchId && !history.branch_id) {
            data.branch_id = visit.branchId;
        }

        if (visit.departmentId && !history.department_id) {
            data.department_id = visit.departmentId;
        }

        if (Object.keys(data).length === 0) {
            return;
        }

        await tx.patient_history.updateMany({
            where: { patient_history_id: history.patient_history_id },
            data
        });

    }

    // The visit's prescription of one kind. A visit can have an ADVICE and a
    // CHEMOTHERAPY prescription at the same time, so the lookup is always
    // scoped by type; otherwise a Submit would merge the plan into the Advice
    // rows (the one-prescription model).
    async findPrescriptionForEncounter(
        tx: Prisma.TransactionClient,
        params: {
            encounterNo: string;
            appointmentId?: string | null;
            prescriptionType: string;
        }
    ) {

        const include = {
            prescription_items: {
                select: {
                    prescription_item_id: true,
                    medicine_id: true,
                    drug_name: true,
                    drug_role: true
                }
            }
        };

        const where: Prisma.prescriptionWhereInput = {
            prescription_type: params.prescriptionType,
            prescription_status: { not: "CANCELLED" }
        };

        const byEncounter = await tx.prescription.findFirst({
            where: { ...where, encounter_no: params.encounterNo },
            orderBy: { created_at: "asc" },
            include
        });

        if (byEncounter) {
            return byEncounter;
        }

        if (!params.appointmentId) {
            return null;
        }

        return tx.prescription.findFirst({
            where: {
                ...where,
                patient_history: { appointment_id: params.appointmentId }
            },
            orderBy: { created_at: "asc" },
            include
        });

    }

    // Finalize every other DRAFT prescription of the encounter, so one Submit
    // locks the visit's Advice prescription as well as the chemotherapy one.
    async finalizeEncounterDrafts(
        tx: Prisma.TransactionClient,
        encounterNo: string,
        exceptPrescriptionId: string
    ) {

        return tx.prescription.updateMany({
            where: {
                encounter_no: encounterNo,
                prescription_id: { not: exceptPrescriptionId },
                prescription_status: "DRAFT"
            },
            data: {
                prescription_status: "FINALIZED"
            }
        });

    }

    async updatePrescriptionHeader(
        tx: Prisma.TransactionClient,
        prescriptionId: string,
        data: Prisma.prescriptionUncheckedUpdateInput
    ) {

        return tx.prescription.update({
            where: { prescription_id: prescriptionId },
            data
        });

    }

    async generatePatientHistoryId(tx: Prisma.TransactionClient) {

        return generateId(tx, "PATIENT_HISTORY");

    }

    async createPatientHistory(tx: Prisma.TransactionClient, data: Prisma.patient_historyUncheckedCreateInput) {

        return tx.patient_history.create({ data });

    }

    async generatePrescriptionNumber(tx: Prisma.TransactionClient) {

        return generateId(tx, "PRESCRIPTION");

    }

    async generatePrescriptionItemId(tx: Prisma.TransactionClient) {

        return generateId(tx, "PRESCRIPTION_ITEM");

    }

    // One sequence lock + one update for the whole batch instead of three
    // queries per item - keeps the createPrescription transaction far
    // under Prisma's interactive transaction timeout.
    async generatePrescriptionItemIds(tx: Prisma.TransactionClient, count: number) {

        return generateIdBatch(tx, "PRESCRIPTION_ITEM", count);

    }

    async createPrescription(tx: Prisma.TransactionClient, data: Prisma.prescriptionUncheckedCreateInput) {

        return tx.prescription.create({ data });

    }

    async createPrescriptionItem(tx: Prisma.TransactionClient, data: Prisma.prescription_itemsUncheckedCreateInput) {

        return tx.prescription_items.create({
            data,
            include: prescriptionItemInclude
        });

    }

    async createPrescriptionItems(tx: Prisma.TransactionClient, data: Prisma.prescription_itemsUncheckedCreateInput[]) {

        await tx.prescription_items.createMany({ data });

    }

    async getPrescriptionById(prescriptionId: string) {

        return prisma.prescription.findUnique({
            where: { prescription_id: prescriptionId },
            include: prescriptionDetailInclude
        });

    }

    async updatePrescription(prescriptionId: string, data: Prisma.prescriptionUncheckedUpdateInput) {

        return prisma.prescription.update({
            where: { prescription_id: prescriptionId },
            data,
            include: prescriptionDetailInclude
        });

    }

    async findPrescriptionItem(prescriptionId: string, itemId: string) {

        return prisma.prescription_items.findFirst({
            where: {
                prescription_item_id: itemId,
                prescription_id: prescriptionId
            }
        });

    }

    async findDuplicateMedicineItem(prescriptionId: string, medicineId: string, excludeItemId?: string) {

        return prisma.prescription_items.findFirst({
            where: {
                prescription_id: prescriptionId,
                medicine_id: medicineId,
                ...(excludeItemId
                    ? { prescription_item_id: { not: excludeItemId } }
                    : {})
            }
        });

    }

    async getPrescriptionItems(prescriptionId: string) {

        return prisma.prescription_items.findMany({
            where: { prescription_id: prescriptionId },
            include: prescriptionItemInclude,
            orderBy: { id: "asc" }
        });

    }

    async updatePrescriptionItem(itemId: string, data: Prisma.prescription_itemsUncheckedUpdateInput) {

        return prisma.prescription_items.update({
            where: { prescription_item_id: itemId },
            data,
            include: prescriptionItemInclude
        });

    }

    async deletePrescriptionItem(itemId: string) {

        return prisma.prescription_items.delete({
            where: { prescription_item_id: itemId }
        });

    }

    async getSuggestedMedicines(diagnosisId: string) {

        return prisma.diagnosis_medicine_mapping.findMany({
            where: { diagnosis_id: diagnosisId },
            include: {
                medicine_master: {
                    select: {
                        medicine_id: true,
                        medicine_name: true,
                        generic_name: true,
                        dosage_form: true,
                        strength: true,
                        route: true
                    }
                }
            },
            orderBy: [{ is_primary: "desc" }]
        });

    }

    async getPrescriptions(query: GetPrescriptionsQuery) {

        const {
            branchId,
            doctorId,
            patientHistoryId,
            appointmentId,
            encounterNo,
            prescriptionType,
            diagnosisId,
            status,
            date,
            dateFrom,
            dateTo,
            search,
            sortBy = "prescription_date",
            sortOrder = "desc",
            page = 1,
            limit = 10
        } = query;

        const where: Prisma.prescriptionWhereInput = {};

        if (branchId) where.branch_id = branchId;
        if (doctorId) where.employee_id = doctorId;
        if (patientHistoryId) where.patient_history_id = patientHistoryId;
        if (encounterNo) where.encounter_no = encounterNo;
        if (prescriptionType) where.prescription_type = prescriptionType;
        if (diagnosisId) where.diagnosis_id = diagnosisId;
        if (status) where.prescription_status = status;

        if (appointmentId) {
            where.patient_history = { appointment_id: appointmentId };
        }

        if (date) {
            where.prescription_date = {
                gte: startOfDay(date),
                lt: startOfNextDay(date)
            };
        } else if (dateFrom || dateTo) {
            where.prescription_date = {
                ...(dateFrom ? { gte: startOfDay(dateFrom) } : {}),
                ...(dateTo ? { lt: startOfNextDay(dateTo) } : {})
            };
        }

        if (search) {
            where.OR = [
                { prescription_id: { contains: search, mode: "insensitive" } },
                {
                    patient_history: {
                        patient_bio_data: {
                            OR: [
                                { patient_first_name: { contains: search, mode: "insensitive" } },
                                { patient_last_name: { contains: search, mode: "insensitive" } }
                            ]
                        }
                    }
                },
                {
                    employees: {
                        OR: [
                            { first_name: { contains: search, mode: "insensitive" } },
                            { last_name: { contains: search, mode: "insensitive" } }
                        ]
                    }
                }
            ];
        }

        const orderBy: Prisma.prescriptionOrderByWithRelationInput =
            sortBy === "created_at"
                ? { created_at: sortOrder }
                : sortBy === "status"
                    ? { prescription_status: sortOrder }
                    : { prescription_date: sortOrder };

        const [prescriptions, total] = await Promise.all([
            prisma.prescription.findMany({
                where,
                include: prescriptionDetailInclude,
                orderBy,
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.prescription.count({ where })
        ]);

        return {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            prescriptions
        };

    }

    async getPrescriptionsByPatientHistoryId(patientHistoryId: string) {

        const where: Prisma.prescriptionWhereInput = {
            patient_history_id: patientHistoryId
        };

        const prescriptions = await prisma.prescription.findMany({
            where,
            include: prescriptionDetailInclude,
            orderBy: { prescription_date: "desc" }
        });

        return prescriptions;
    }

    async getPrescriptionsByPatientId(patientId: string, query: GetPrescriptionsQuery = {}) {
        const {
            branchId,
            doctorId,
            status,
            date,
            dateFrom,
            dateTo,
            search,
            sortBy = "prescription_date",
            sortOrder = "desc",
            page = 1,
            limit = 10
        } = query;

        const where: Prisma.prescriptionWhereInput = {
            patient_history: {
                patient_id: patientId
            }
        };

        if (branchId) where.branch_id = branchId;
        if (doctorId) where.employee_id = doctorId;
        if (status) where.prescription_status = status;

        if (date) {
            where.prescription_date = {
                gte: startOfDay(date),
                lt: startOfNextDay(date)
            };
        } else if (dateFrom || dateTo) {
            where.prescription_date = {
                ...(dateFrom ? { gte: startOfDay(dateFrom) } : {}),
                ...(dateTo ? { lt: startOfNextDay(dateTo) } : {})
            };
        }

        if (search) {
            where.OR = [
                { prescription_id: { contains: search, mode: "insensitive" } },
                {
                    patient_history: {
                        patient_bio_data: {
                            OR: [
                                { patient_first_name: { contains: search, mode: "insensitive" } },
                                { patient_last_name: { contains: search, mode: "insensitive" } }
                            ]
                        }
                    }
                },
                {
                    employees: {
                        OR: [
                            { first_name: { contains: search, mode: "insensitive" } },
                            { last_name: { contains: search, mode: "insensitive" } }
                        ]
                    }
                }
            ];
        }

        const orderBy: Prisma.prescriptionOrderByWithRelationInput =
            sortBy === "created_at"
                ? { created_at: sortOrder }
                : sortBy === "status"
                    ? { prescription_status: sortOrder }
                    : { prescription_date: sortOrder };

        const [prescriptions, total] = await Promise.all([
            prisma.prescription.findMany({
                where,
                include: prescriptionDetailInclude,
                orderBy,
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.prescription.count({ where })
        ]);

        return {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            prescriptions
        };
    }

}
