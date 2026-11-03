import prisma from "../../config/prisma";
import { PrescriptionRepository } from "./prescription.repository";
import { PRESCRIPTION_STATUS, PRESCRIPTION_TYPE } from "./prescription.constants";

import {
    CreatePrescriptionDto,
    UpdatePrescriptionDto,
    AddPrescriptionItemDto,
    UpdatePrescriptionItemDto,
    GetPrescriptionsQuery,
    MedicineItemDto,
    SearchMedicinesQuery,
    CreateMedicineDto
} from "./prescription.types";

// There is no dedicated "encounter" module in this codebase - the encounter
// table's status column defaults to "OPEN" (see prisma/schema.prisma), so
// that value is inlined here rather than importing a shared constant.
const ENCOUNTER_STATUS_OPEN = "OPEN";

const repository = new PrescriptionRepository();

function computeQuantity(item: {
    quantity?: number;
    days?: number;
    morning?: boolean;
    afternoon?: boolean;
    night?: boolean;
}): number | undefined {

    if (item.quantity !== undefined && item.quantity !== null) {
        return item.quantity;
    }

    if (!item.days) {
        return undefined;
    }

    const dosesPerDay =
        (item.morning ? 1 : 0) +
        (item.afternoon ? 1 : 0) +
        (item.night ? 1 : 0);

    if (dosesPerDay === 0) {
        return undefined;
    }

    return dosesPerDay * item.days;

}

type DrugMetadata = {
    drug_role?: string | null;
    drug_type?: string | null;
    chemotherapy_plan_id?: string | null;
    plan_order_id?: string | null;
    plan_item_id?: string | null;
    cycle_number?: number | null;
    cycle_day?: number | null;
};

// The authoritative plan-item row for a linked item. Its drug_role was copied
// from chemotherapy_regimen_protocol_items when the plan was created.
type PlanItemMetadata = {
    chemotherapy_plan_item_id: string;
    chemotherapy_plan_id: string;
    plan_order_id: string | null;
    drug_role: string;
    drug_type: string | null;
    cycle_day: number | null;
};

// A medicine may legitimately appear twice on one visit's prescription with a
// different role (e.g. the same drug as pre-medication and as supportive
// care). Duplicates are therefore scoped to the medicine + role.
function prescriptionItemKey(item: {
    medicine_id?: string | null;
    drug_name?: string | null;
    drug_role?: string | null;
}): string {

    const role = (item.drug_role || "PRIMARY").toUpperCase();

    if (item.medicine_id) {
        return `id:${item.medicine_id}|${role}`;
    }

    return `name:${(item.drug_name ?? "").trim().toLowerCase()}|${role}`;

}

type ResolvedMedicineItem = MedicineItemDto & {
    resolved_route?: string;
    resolved_quantity?: number;
    // Final role/plan-link metadata for this row. Advice prescriptions leave
    // it undefined (no plan inheritance); chemotherapy rows always get one.
    resolved_meta?: DrugMetadata;
};

function prescriptionItemData(
    item: ResolvedMedicineItem
) {

    const meta = item.resolved_meta;

    return {
        medicine_id: item.medicine_id || null,
        drug_name: item.medicine_id ? null : item.drug_name?.trim() || null,
        dosage: item.dosage,
        unit: item.unit,
        route: item.resolved_route,
        frequency: item.frequency,
        before_after_food: item.before_after_food,
        morning: item.morning ?? false,
        afternoon: item.afternoon ?? false,
        night: item.night ?? false,
        days: item.days,
        duration: item.duration,
        quantity: item.resolved_quantity,
        instruction: item.instruction,
        drug_role: meta?.drug_role ?? item.drug_role ?? "PRIMARY",
        drug_type: meta?.drug_type ?? item.drug_type ?? null,
        chemotherapy_plan_id: meta?.chemotherapy_plan_id ?? item.chemotherapy_plan_id ?? null,
        plan_order_id: meta?.plan_order_id ?? item.plan_order_id ?? null,
        plan_item_id: meta?.plan_item_id ?? item.plan_item_id ?? null,
        cycle_number: meta?.cycle_number ?? item.cycle_number ?? null,
        cycle_day: meta?.cycle_day ?? item.cycle_day ?? null
    };

}

function prescriptionItemRole(item: ResolvedMedicineItem): string {

    return (item.resolved_meta?.drug_role ?? item.drug_role ?? "PRIMARY").toUpperCase();

}

export class PrescriptionService {

    async createPrescription(data: CreatePrescriptionDto, createdBy: string) {

        void createdBy; // no created_by column on prescription today - kept for interface symmetry

        const encounter = await repository.findEncounterForPrescription(data.encounter_no);

        if (!encounter) {
            throw new Error("Encounter not found");
        }

        if (encounter.status !== ENCOUNTER_STATUS_OPEN) {
            throw new Error("A prescription can only be created against an OPEN encounter");
        }

        const patient = encounter.patient_bio_data;

        if (!patient) {
            throw new Error("Patient not found for this encounter");
        }

        const doctor = encounter.employees;

        if (!doctor || !doctor.employee_id) {
            throw new Error("Doctor not found for this encounter");
        }

        const doctorEmployeeId = doctor.employee_id;

        if (!data.medicines || data.medicines.length === 0) {
            throw new Error("At least one medicine is required");
        }

        // Items with a medicine_id come from medicine_master; the rest are
        // drug names typed on the chemotherapy order (free text).
        const medicineIds = data.medicines
            .map((item) => item.medicine_id)
            .filter((id): id is string => Boolean(id));

        for (const item of data.medicines) {
            if (!item.medicine_id && !item.drug_name?.trim()) {
                throw new Error("Each medicine needs a medicine from the list or a drug name");
            }
        }

        // A visit can produce two prescriptions: the Advice one (all items
        // role ADVICE) and the chemotherapy one (plan roles). They must never
        // mix, because each has its own identity and lifecycle.
        const requestedRoles = data.medicines.map((item) =>
            (item.drug_role ?? "").toUpperCase()
        );
        const allAdvice = requestedRoles.every(
            (role) => role === PRESCRIPTION_TYPE.ADVICE
        );
        const anyAdvice = requestedRoles.some(
            (role) => role === PRESCRIPTION_TYPE.ADVICE
        );

        if (anyAdvice && !allAdvice) {
            throw new Error("Advice and chemotherapy medicines cannot be mixed in one prescription");
        }

        let prescriptionType: string =
            data.prescription_type ??
            (allAdvice ? PRESCRIPTION_TYPE.ADVICE : PRESCRIPTION_TYPE.CHEMOTHERAPY);

        if (allAdvice) {
            prescriptionType = PRESCRIPTION_TYPE.ADVICE;
        } else if (prescriptionType === PRESCRIPTION_TYPE.ADVICE) {
            throw new Error("An Advice prescription can only contain Advice medicines");
        }

        const isAdvicePrescription = prescriptionType === PRESCRIPTION_TYPE.ADVICE;

        // One round-trip validates every medicine instead of one query
        // per item (high-latency remote database).
        const medicines = await repository.findMedicines(medicineIds);

        const foundMedicineIds = new Set(medicines.map((medicine) => medicine.medicine_id));

        for (const medicineId of medicineIds) {
            if (!foundMedicineIds.has(medicineId)) {
                throw new Error(`Medicine not found: ${medicineId}`);
            }
        }

        const medicineRouteById = new Map(
            medicines.map((medicine) => [medicine.medicine_id, medicine.route ?? undefined])
        );

        // Advice rows never inherit plan metadata. Chemotherapy rows take the
        // role from the linked plan item (the plan's copy of the regimen
        // protocol item), then the client row, then the plan's medicine row.
        const drugMetadata: Map<string, DrugMetadata> = isAdvicePrescription
            ? new Map()
            : await repository.findDrugMetadata(
                data.encounter_no,
                encounter.patient_id,
                medicineIds
            );

        const planItemIds = data.medicines
            .map((item) => item.plan_item_id)
            .filter((id): id is string => Boolean(id));

        const planItemMetadata: Map<string, PlanItemMetadata> =
            isAdvicePrescription || planItemIds.length === 0
                ? new Map()
                : await repository.findPlanItemMetadata(planItemIds, {
                    encounterNo: data.encounter_no,
                    patientId: encounter.patient_id
                });

        const resolvedItems: ResolvedMedicineItem[] = data.medicines.map((item) => {

            const byMedicine = item.medicine_id ? drugMetadata.get(item.medicine_id) : undefined;
            const byPlanItem = item.plan_item_id ? planItemMetadata.get(item.plan_item_id) : undefined;

            return {
                ...item,
                // Advice items are always stamped ADVICE, whatever the client
                // sent, and carry no plan/cycle metadata.
                ...(isAdvicePrescription ? { drug_role: PRESCRIPTION_TYPE.ADVICE } : {}),
                resolved_route: item.route ?? (item.medicine_id ? medicineRouteById.get(item.medicine_id) : undefined),
                resolved_quantity: computeQuantity(item),
                resolved_meta: isAdvicePrescription
                    ? undefined
                    : {
                        drug_role: byPlanItem?.drug_role ?? item.drug_role ?? byMedicine?.drug_role ?? "PRIMARY",
                        drug_type: byPlanItem?.drug_type ?? item.drug_type ?? byMedicine?.drug_type ?? null,
                        chemotherapy_plan_id: byPlanItem?.chemotherapy_plan_id ?? item.chemotherapy_plan_id ?? byMedicine?.chemotherapy_plan_id ?? null,
                        plan_order_id: byPlanItem?.plan_order_id ?? item.plan_order_id ?? byMedicine?.plan_order_id ?? null,
                        plan_item_id: item.plan_item_id ?? byMedicine?.plan_item_id ?? null,
                        cycle_number: item.cycle_number ?? byMedicine?.cycle_number ?? null,
                        cycle_day: item.cycle_day ?? byPlanItem?.cycle_day ?? byMedicine?.cycle_day ?? null
                    }
            };

        });

        // Duplicate rows are scoped to medicine + role: the same drug may be
        // prescribed once under two legitimate roles.
        const seenKeys = new Set<string>();

        for (const item of resolvedItems) {

            const key = prescriptionItemKey({
                medicine_id: item.medicine_id,
                drug_name: item.drug_name,
                drug_role: prescriptionItemRole(item)
            });

            if (seenKeys.has(key)) {
                throw new Error(
                    `Duplicate medicine entries are not allowed within the same prescription: ${item.medicine_id || item.drug_name}`
                );
            }

            seenKeys.add(key);

        }

        const diagnosisId = data.diagnosis_id ?? encounter.diagnosis_id ?? undefined;

        if (diagnosisId) {
            const diagnosis = await repository.findDiagnosis(diagnosisId);
            if (!diagnosis) {
                throw new Error("Diagnosis not found");
            }
        }

        // Interactive transaction options - the default 5000ms timeout was
        // exceeded on multi-medicine prescriptions (remote Supabase latency
        // x sequential id-generation queries), so both the timeout and the
        // in-transaction work are tuned here.
        const prescriptionId = await prisma.$transaction(async (tx) => {

            // One prescription per kind per visit. "Proceed to Next" saves the
            // ADVICE rows; "Submit" writes a separate CHEMOTHERAPY
            // prescription, so the same patient can receive Advice medicines
            // and a chemotherapy plan on the same day. Re-submitting the same
            // kind is a no-op/merge, never a duplicate.
            const existing = await repository.findPrescriptionForEncounter(tx, {
                encounterNo: data.encounter_no,
                appointmentId: encounter.appointment_id,
                prescriptionType
            });

            if (existing) {

                // Re-submitting a completed prescription is a no-op, not an
                // error. Still lock the visit's other drafts when asked.
                if (existing.prescription_status === PRESCRIPTION_STATUS.FINALIZED) {

                    if (data.finalize_encounter) {
                        await repository.finalizeEncounterDrafts(
                            tx,
                            data.encounter_no,
                            existing.prescription_id
                        );
                    }

                    return existing.prescription_id;

                }

                const existingKeys = new Set(
                    (existing.prescription_items ?? []).map((item) => prescriptionItemKey(item))
                );

                const itemsToAdd = resolvedItems.filter((item) =>
                    !existingKeys.has(
                        prescriptionItemKey({
                            medicine_id: item.medicine_id,
                            drug_name: item.drug_name,
                            drug_role: prescriptionItemRole(item)
                        })
                    )
                );

                if (itemsToAdd.length > 0) {

                    const itemIds = await repository.generatePrescriptionItemIds(
                        tx,
                        itemsToAdd.length
                    );

                    await repository.createPrescriptionItems(
                        tx,
                        itemsToAdd.map((item, index) => ({
                            prescription_item_id: itemIds[index],
                            prescription_id: existing.prescription_id,
                            ...prescriptionItemData(item)
                        }))
                    );

                }

                await repository.updatePrescriptionHeader(tx, existing.prescription_id, {
                    ...(diagnosisId ? { diagnosis_id: diagnosisId } : {}),
                    ...(data.chief_complaint ? { chief_complaint: data.chief_complaint } : {}),
                    ...(data.clinical_notes ? { clinical_notes: data.clinical_notes } : {}),
                    ...(data.advice ? { advice: data.advice } : {}),
                    ...(data.followup_date ? { followup_date: new Date(data.followup_date) } : {}),
                    ...(data.finalize ? { prescription_status: PRESCRIPTION_STATUS.FINALIZED } : {})
                });

                if (data.finalize_encounter) {
                    await repository.finalizeEncounterDrafts(
                        tx,
                        data.encounter_no,
                        existing.prescription_id
                    );
                }

                return existing.prescription_id;

            }

            // Reuse the visit's existing history (appointment / encounter /
            // chemo plan / recent row) instead of inserting a duplicate one.
            let patientHistory = await repository.findPatientHistoryForVisit(tx, {
                patientId: encounter.patient_id,
                appointmentId: encounter.appointment_id,
                encounterNo: encounter.encounter_no
            });

            if (patientHistory) {

                await repository.linkPatientHistoryToVisit(tx, patientHistory, {
                    appointmentId: encounter.appointment_id,
                    encounterNo: encounter.encounter_no,
                    branchId: encounter.branch_id,
                    departmentId: encounter.department_id
                });

            } else {

                const patientHistoryId = await repository.generatePatientHistoryId(tx);

                patientHistory = await repository.createPatientHistory(tx, {
                    patient_history_id: patientHistoryId,
                    patient_id: encounter.patient_id,
                    appointment_id: encounter.appointment_id,
                    encounter_no: encounter.encounter_no,
                    branch_id: encounter.branch_id,
                    department_id: encounter.department_id,
                    diagnosis_id: diagnosisId,
                    employee_id: doctorEmployeeId,
                    visit_type: data.visit_type ?? encounter.encounter_type,
                    visit_date: new Date(),
                    visit_status: "IN_PROGRESS"
                });

            }

            const generatedPrescriptionId = await repository.generatePrescriptionNumber(tx);

            const prescription = await repository.createPrescription(tx, {
                prescription_id: generatedPrescriptionId,
                employee_id: doctorEmployeeId,
                department_id: encounter.department_id,
                diagnosis_id: diagnosisId,
                patient_history_id: patientHistory.patient_history_id,
                encounter_no: encounter.encounter_no,
                prescription_type: prescriptionType,
                visit_type: data.visit_type ?? encounter.encounter_type,
                chief_complaint: data.chief_complaint ?? encounter.chief_complaint,
                clinical_notes: data.clinical_notes ?? encounter.clinical_notes,
                advice: data.advice ?? encounter.advice,
                followup_date: data.followup_date
                    ? new Date(data.followup_date)
                    : encounter.follow_up_date,
                prescription_status: data.finalize
                    ? PRESCRIPTION_STATUS.FINALIZED
                    : PRESCRIPTION_STATUS.DRAFT,
                branch_id: encounter.branch_id,
                user_id: doctor.user_id
            });

            // All item ids come from one sequence lock instead of a lock +
            // collision-check + sequence-update per item; items themselves
            // are inserted with a single createMany. The caller re-reads the
            // full prescription afterwards, so no per-item return is needed.
            const itemIds = await repository.generatePrescriptionItemIds(
                tx,
                resolvedItems.length
            );

            await repository.createPrescriptionItems(
                tx,
                resolvedItems.map((item, index) => ({
                    prescription_item_id: itemIds[index],
                    prescription_id: prescription.prescription_id,
                    ...prescriptionItemData(item)
                }))
            );

            if (data.finalize_encounter) {
                await repository.finalizeEncounterDrafts(
                    tx,
                    data.encounter_no,
                    prescription.prescription_id
                );
            }

            return prescription.prescription_id;

        }, {
            timeout: 30000,
            maxWait: 10000
        });

        return repository.getPrescriptionById(prescriptionId);

    }

    async getPrescriptions(query: GetPrescriptionsQuery) {

        return repository.getPrescriptions(query);

    }

    async getPrescriptionById(prescriptionId: string) {

        const prescription = await repository.getPrescriptionById(prescriptionId);

        if (!prescription) {
            throw new Error("Prescription not found");
        }

        return prescription;

    }

    async updatePrescription(prescriptionId: string, data: UpdatePrescriptionDto, actingRole: string) {

        const existing = await repository.getPrescriptionById(prescriptionId);

        if (!existing) {
            throw new Error("Prescription not found");
        }

        const nextStatus = data.status;

        if (nextStatus && nextStatus !== existing.prescription_status) {

            if (nextStatus === PRESCRIPTION_STATUS.FINALIZED) {

                if (existing.prescription_status !== PRESCRIPTION_STATUS.DRAFT) {
                    throw new Error("Only a draft prescription can be finalized");
                }

            } else if (nextStatus === PRESCRIPTION_STATUS.DRAFT) {

                if (existing.prescription_status !== PRESCRIPTION_STATUS.FINALIZED) {
                    throw new Error("Only a finalized prescription can be reopened");
                }

                // The JWT payload only carries the caller's role today (see
                // auth.middleware.ts), so "authorized doctor" is enforced on role.
                if (actingRole !== "DOCTOR") {
                    throw new Error("Only a doctor can reopen a finalized prescription");
                }

            } else if (nextStatus === PRESCRIPTION_STATUS.CANCELLED) {

                if (existing.prescription_status === PRESCRIPTION_STATUS.CANCELLED) {
                    throw new Error("Prescription is already cancelled");
                }

            } else {
                throw new Error("Invalid prescription status");
            }

        } else if (existing.prescription_status === PRESCRIPTION_STATUS.FINALIZED) {
            throw new Error("Prescription is finalized and read-only. Reopen it before editing.");
        } else if (existing.prescription_status === PRESCRIPTION_STATUS.CANCELLED) {
            throw new Error("Cannot edit a cancelled prescription");
        }

        if (data.diagnosis_id) {
            const diagnosis = await repository.findDiagnosis(data.diagnosis_id);
            if (!diagnosis) {
                throw new Error("Diagnosis not found");
            }
        }

        return repository.updatePrescription(prescriptionId, {
            chief_complaint: data.chief_complaint,
            clinical_notes: data.clinical_notes,
            advice: data.advice,
            followup_date: data.followup_date
                ? new Date(data.followup_date)
                : undefined,
            diagnosis_id: data.diagnosis_id,
            prescription_status: nextStatus ?? existing.prescription_status
        });

    }

    async deletePrescription(prescriptionId: string) {

        const existing = await repository.getPrescriptionById(prescriptionId);

        if (!existing) {
            throw new Error("Prescription not found");
        }

        if (existing.prescription_status === PRESCRIPTION_STATUS.CANCELLED) {
            throw new Error("Prescription is already cancelled");
        }

        return repository.updatePrescription(prescriptionId, {
            prescription_status: PRESCRIPTION_STATUS.CANCELLED
        });

    }

    async getPrescriptionItems(prescriptionId: string) {

        const existing = await repository.getPrescriptionById(prescriptionId);

        if (!existing) {
            throw new Error("Prescription not found");
        }

        return repository.getPrescriptionItems(prescriptionId);

    }

    async addPrescriptionItem(prescriptionId: string, data: AddPrescriptionItemDto) {

        const existing = await repository.getPrescriptionById(prescriptionId);

        if (!existing) {
            throw new Error("Prescription not found");
        }

        if (existing.prescription_status !== PRESCRIPTION_STATUS.DRAFT) {
            throw new Error("Cannot add items to a prescription that is not in draft status");
        }

        const medicineId = data.medicine_id || null;
        const drugName = medicineId ? null : data.drug_name?.trim() || null;

        if (!medicineId && !drugName) {
            throw new Error("Select a medicine from the list or enter a drug name");
        }

        const medicine = medicineId ? await repository.findMedicine(medicineId) : null;

        if (medicineId) {

            if (!medicine) {
                throw new Error(`Medicine not found: ${medicineId}`);
            }

            const duplicate = await repository.findDuplicateMedicineItem(prescriptionId, medicineId);

            if (duplicate) {
                throw new Error("This medicine already exists in the prescription");
            }

        }

        const quantity = computeQuantity(data);

        const drugMetadata = await repository.findDrugMetadata(
            "",
            existing.patient_history?.patient_bio_data?.patient_id ?? "",
            medicineId ? [medicineId] : []
        );

        const meta = medicineId ? drugMetadata.get(medicineId) : undefined;

        return prisma.$transaction(async (tx) => {

            const itemId = await repository.generatePrescriptionItemId(tx);

            return repository.createPrescriptionItem(tx, {
                prescription_item_id: itemId,
                prescription_id: prescriptionId,
                medicine_id: medicineId,
                drug_name: drugName,
                dosage: data.dosage,
                unit: data.unit,
                route: data.route ?? medicine?.route ?? undefined,
                frequency: data.frequency,
                before_after_food: data.before_after_food,
                morning: data.morning ?? false,
                afternoon: data.afternoon ?? false,
                night: data.night ?? false,
                days: data.days,
                duration: data.duration,
                quantity,
                instruction: data.instruction,
                drug_role: data.drug_role || meta?.drug_role || "PRIMARY",
                drug_type: data.drug_type || meta?.drug_type || null
            });

        });

    }

    async updatePrescriptionItem(prescriptionId: string, itemId: string, data: UpdatePrescriptionItemDto) {

        const existing = await repository.getPrescriptionById(prescriptionId);

        if (!existing) {
            throw new Error("Prescription not found");
        }

        if (existing.prescription_status !== PRESCRIPTION_STATUS.DRAFT) {
            throw new Error("Cannot edit items on a prescription that is not in draft status");
        }

        const item = await repository.findPrescriptionItem(prescriptionId, itemId);

        if (!item) {
            throw new Error("Prescription item not found");
        }

        let resolvedRoute = data.route;

        if (data.medicine_id && data.medicine_id !== item.medicine_id) {

            const medicine = await repository.findMedicine(data.medicine_id);

            if (!medicine) {
                throw new Error(`Medicine not found: ${data.medicine_id}`);
            }

            const duplicate = await repository.findDuplicateMedicineItem(prescriptionId, data.medicine_id, itemId);

            if (duplicate) {
                throw new Error("This medicine already exists in the prescription");
            }

            resolvedRoute = data.route ?? medicine.route ?? undefined;

        }

        const quantity = computeQuantity({
            quantity: data.quantity,
            morning: data.morning ?? item.morning ?? undefined,
            afternoon: data.afternoon ?? item.afternoon ?? undefined,
            night: data.night ?? item.night ?? undefined,
            days: data.days ?? item.days ?? undefined
        }) ?? item.quantity ?? undefined;

        // The drug: a medicine from the list, or (medicine_id: null) a
        // typed drug name.
        let drugChanges = {};

        if (data.medicine_id) {
            drugChanges = { medicine_id: data.medicine_id, drug_name: null };
        } else if (data.medicine_id === null || (data.drug_name !== undefined && !item.medicine_id)) {

            if (!data.drug_name?.trim()) {
                throw new Error("Select a medicine from the list or enter a drug name");
            }

            drugChanges = { medicine_id: null, drug_name: data.drug_name.trim() };

        }

        const targetMedicineId = data.medicine_id === null ? null : data.medicine_id || item.medicine_id;

        const drugMetadata = await repository.findDrugMetadata(
            "",
            existing.patient_history?.patient_bio_data?.patient_id ?? "",
            targetMedicineId ? [targetMedicineId] : []
        );

        const meta = targetMedicineId ? drugMetadata.get(targetMedicineId) : undefined;

        return repository.updatePrescriptionItem(itemId, {
            ...drugChanges,
            dosage: data.dosage,
            unit: data.unit,
            route: resolvedRoute,
            frequency: data.frequency,
            before_after_food: data.before_after_food,
            morning: data.morning,
            afternoon: data.afternoon,
            night: data.night,
            days: data.days,
            duration: data.duration,
            quantity,
            instruction: data.instruction,
            drug_role: data.drug_role || meta?.drug_role || item.drug_role || "PRIMARY",
            drug_type: data.drug_type || meta?.drug_type || item.drug_type || null
        });

    }

    async deletePrescriptionItem(prescriptionId: string, itemId: string) {

        const existing = await repository.getPrescriptionById(prescriptionId);

        if (!existing) {
            throw new Error("Prescription not found");
        }

        if (existing.prescription_status !== PRESCRIPTION_STATUS.DRAFT) {
            throw new Error("Cannot remove items from a prescription that is not in draft status");
        }

        const item = await repository.findPrescriptionItem(prescriptionId, itemId);

        if (!item) {
            throw new Error("Prescription item not found");
        }

        return repository.deletePrescriptionItem(itemId);

    }

    async getSuggestedMedicines(diagnosisId: string) {

        const diagnosis = await repository.findDiagnosis(diagnosisId);

        if (!diagnosis) {
            throw new Error("Diagnosis not found");
        }

        return repository.getSuggestedMedicines(diagnosisId);

    }

    async searchMedicines(query: SearchMedicinesQuery) {

        const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
        const search = (query.search ?? "").trim().toLowerCase();
        const words = search.split(/\s+/).filter(Boolean);

        if (words.length === 0) {
            return repository.searchMedicines([], limit);
        }

        // Pull a wider window, then rank names that start with the search
        // ahead of mid-word matches so "para" lists Paracetamol first.
        const matches = await repository.searchMedicines(words, 200);

        const rank = (name: string) => {
            const lower = name.toLowerCase();
            if (lower.startsWith(search)) return 0;
            if (lower.startsWith(words[0])) return 1;
            return 2;
        };

        return matches
            .sort((a, b) => rank(a.medicine_name) - rank(b.medicine_name))
            .slice(0, limit);

    }

    // Adds a doctor-typed drug to medicine_master so it can be linked on a
    // prescription (prescription_items.medicine_id is a required FK). An
    // existing row with the same name is returned instead of duplicating it.
    async createMedicine(data: CreateMedicineDto, createdBy?: string) {

        const medicineName = data.medicine_name.trim().replace(/\s+/g, " ");

        const existing = await repository.findMedicineByName(medicineName);

        if (existing) {
            return { medicine: existing, created: false };
        }

        // medicine_master has no id_sequences entry; it keeps the informal
        // "MED" + 6-digit convention (see prisma/seedChemoDrugs.ts).
        for (let attempt = 0; attempt < 3; attempt++) {

            const lastId = await repository.findLastMedicineId();
            const lastNumber = lastId ? parseInt(lastId.replace(/\D/g, ""), 10) || 0 : 0;
            const medicineId = "MED" + String(lastNumber + 1).padStart(6, "0");

            try {

                const medicine = await repository.createMedicine({
                    medicine_id: medicineId,
                    medicine_name: medicineName,
                    dosage_form: data.dosage_form?.trim() || null,
                    unit: data.unit?.trim() || null,
                    strength: data.strength?.trim() || null,
                    is_active: true,
                    source_note: `Added from OPD consultation (Advice)${createdBy ? ` by ${createdBy}` : ""}`
                });

                return { medicine, created: true };

            } catch (error: any) {

                // Another request took this id first - re-read the max and retry.
                if (error?.code === "P2002" && attempt < 2) {
                    continue;
                }

                throw error;

            }

        }

        throw new Error("Could not allocate a medicine id. Please try again.");

    }

    async getPrescriptionsByPatientHistoryId(patientHistoryId: string) {
        return repository.getPrescriptionsByPatientHistoryId(patientHistoryId);
    }

    async getPrescriptionsByPatientId(patientId: string, query: GetPrescriptionsQuery) {
        return repository.getPrescriptionsByPatientId(patientId, query);
    }

}
