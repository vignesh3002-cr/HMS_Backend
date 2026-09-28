import prisma from "../../config/prisma";
import { PrescriptionRepository } from "./prescription.repository";
import { PRESCRIPTION_STATUS } from "./prescription.constants";

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

        const seenMedicineIds = new Set<string>();

        for (const item of data.medicines) {
            if (seenMedicineIds.has(item.medicine_id)) {
                throw new Error(`Duplicate medicine entries are not allowed within the same prescription: ${item.medicine_id}`);
            }
            seenMedicineIds.add(item.medicine_id);
        }

        // One round-trip validates every medicine instead of one query
        // per item (high-latency remote database).
        const medicines = await repository.findMedicines(
            data.medicines.map((item) => item.medicine_id)
        );

        const foundMedicineIds = new Set(medicines.map((medicine) => medicine.medicine_id));

        for (const item of data.medicines) {
            if (!foundMedicineIds.has(item.medicine_id)) {
                throw new Error(`Medicine not found: ${item.medicine_id}`);
            }
        }

        const medicineRouteById = new Map(
            medicines.map((medicine) => [medicine.medicine_id, medicine.route ?? undefined])
        );

        const resolvedItems: Array<MedicineItemDto & { resolved_route?: string; resolved_quantity?: number }> = data.medicines.map((item) => ({
            ...item,
            resolved_route: item.route ?? medicineRouteById.get(item.medicine_id),
            resolved_quantity: computeQuantity(item)
        }));

        // Resolve drug_role/drug_type for each medicine from the patient's
        // chemotherapy plan (derived server-side). Falls back to PRIMARY/null
        // when no plan entry exists (e.g. non-chemo OPD prescriptions).
        const drugMetadata = await repository.findDrugMetadata(
            data.encounter_no,
            encounter.patient_id,
            data.medicines.map((item) => item.medicine_id)
        );

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

            let patientHistory = encounter.appointment_id
                ? await repository.findPatientHistoryByAppointment(encounter.appointment_id)
                : null;

            if (!patientHistory) {

                const patientHistoryId = await repository.generatePatientHistoryId(tx);

                patientHistory = await repository.createPatientHistory(tx, {
                    patient_history_id: patientHistoryId,
                    patient_id: encounter.patient_id,
                    appointment_id: encounter.appointment_id,
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
                visit_type: data.visit_type ?? encounter.encounter_type,
                chief_complaint: data.chief_complaint ?? encounter.chief_complaint,
                clinical_notes: data.clinical_notes ?? encounter.clinical_notes,
                advice: data.advice ?? encounter.advice,
                followup_date: data.followup_date
                    ? new Date(data.followup_date)
                    : encounter.follow_up_date,
                prescription_status: PRESCRIPTION_STATUS.DRAFT,
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
                resolvedItems.map((item, index) => {
                    const meta = drugMetadata.get(item.medicine_id);
                    return {
                        prescription_item_id: itemIds[index],
                        prescription_id: prescription.prescription_id,
                        medicine_id: item.medicine_id,
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
                        drug_type: meta?.drug_type ?? item.drug_type ?? null
                    };
                })
            );

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

        const medicine = await repository.findMedicine(data.medicine_id);

        if (!medicine) {
            throw new Error(`Medicine not found: ${data.medicine_id}`);
        }

        const duplicate = await repository.findDuplicateMedicineItem(prescriptionId, data.medicine_id);

        if (duplicate) {
            throw new Error("This medicine already exists in the prescription");
        }

        const quantity = computeQuantity(data);

        const drugMetadata = await repository.findDrugMetadata(
            "",
            existing.patient_history?.patient_bio_data?.patient_id ?? "",
            [data.medicine_id]
        );

        const meta = drugMetadata.get(data.medicine_id);

        return prisma.$transaction(async (tx) => {

            const itemId = await repository.generatePrescriptionItemId(tx);

            return repository.createPrescriptionItem(tx, {
                prescription_item_id: itemId,
                prescription_id: prescriptionId,
                medicine_id: data.medicine_id,
                dosage: data.dosage,
                unit: data.unit,
                route: data.route ?? medicine.route ?? undefined,
                frequency: data.frequency,
                before_after_food: data.before_after_food,
                morning: data.morning ?? false,
                afternoon: data.afternoon ?? false,
                night: data.night ?? false,
                days: data.days,
                duration: data.duration,
                quantity,
                instruction: data.instruction,
                drug_role: meta?.drug_role ?? data.drug_role ?? "PRIMARY",
                drug_type: meta?.drug_type ?? data.drug_type ?? null
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

        const targetMedicineId = data.medicine_id ?? item.medicine_id;

        const drugMetadata = await repository.findDrugMetadata(
            "",
            existing.patient_history?.patient_bio_data?.patient_id ?? "",
            [targetMedicineId]
        );

        const meta = drugMetadata.get(targetMedicineId);

        return repository.updatePrescriptionItem(itemId, {
            medicine_id: data.medicine_id,
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
            drug_role: meta?.drug_role ?? data.drug_role ?? item.drug_role ?? "PRIMARY",
            drug_type: meta?.drug_type ?? data.drug_type ?? item.drug_type ?? null
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
