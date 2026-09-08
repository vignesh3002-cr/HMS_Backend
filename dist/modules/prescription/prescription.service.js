"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrescriptionService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const prescription_repository_1 = require("./prescription.repository");
const prescription_constants_1 = require("./prescription.constants");
// There is no dedicated "encounter" module in this codebase - the encounter
// table's status column defaults to "OPEN" (see prisma/schema.prisma), so
// that value is inlined here rather than importing a shared constant.
const ENCOUNTER_STATUS_OPEN = "OPEN";
const repository = new prescription_repository_1.PrescriptionRepository();
function computeQuantity(item) {
    if (item.quantity !== undefined && item.quantity !== null) {
        return item.quantity;
    }
    if (!item.days) {
        return undefined;
    }
    const dosesPerDay = (item.morning ? 1 : 0) +
        (item.afternoon ? 1 : 0) +
        (item.night ? 1 : 0);
    if (dosesPerDay === 0) {
        return undefined;
    }
    return dosesPerDay * item.days;
}
class PrescriptionService {
    async createPrescription(data, createdBy) {
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
        const seenMedicineIds = new Set();
        for (const item of data.medicines) {
            if (seenMedicineIds.has(item.medicine_id)) {
                throw new Error(`Duplicate medicine entries are not allowed within the same prescription: ${item.medicine_id}`);
            }
            seenMedicineIds.add(item.medicine_id);
        }
        // One round-trip validates every medicine instead of one query
        // per item (high-latency remote database).
        const medicines = await repository.findMedicines(data.medicines.map((item) => item.medicine_id));
        const foundMedicineIds = new Set(medicines.map((medicine) => medicine.medicine_id));
        for (const item of data.medicines) {
            if (!foundMedicineIds.has(item.medicine_id)) {
                throw new Error(`Medicine not found: ${item.medicine_id}`);
            }
        }
        const medicineRouteById = new Map(medicines.map((medicine) => [medicine.medicine_id, medicine.route ?? undefined]));
        const resolvedItems = data.medicines.map((item) => ({
            ...item,
            resolved_route: item.route ?? medicineRouteById.get(item.medicine_id),
            resolved_quantity: computeQuantity(item)
        }));
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
        const prescriptionId = await prisma_1.default.$transaction(async (tx) => {
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
                prescription_status: prescription_constants_1.PRESCRIPTION_STATUS.DRAFT,
                branch_id: encounter.branch_id,
                user_id: doctor.user_id
            });
            // All item ids come from one sequence lock instead of a lock +
            // collision-check + sequence-update per item; items themselves
            // are inserted with a single createMany. The caller re-reads the
            // full prescription afterwards, so no per-item return is needed.
            const itemIds = await repository.generatePrescriptionItemIds(tx, resolvedItems.length);
            await repository.createPrescriptionItems(tx, resolvedItems.map((item, index) => ({
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
                instruction: item.instruction
            })));
            return prescription.prescription_id;
        }, {
            timeout: 30000,
            maxWait: 10000
        });
        return repository.getPrescriptionById(prescriptionId);
    }
    async getPrescriptions(query) {
        return repository.getPrescriptions(query);
    }
    async getPrescriptionById(prescriptionId) {
        const prescription = await repository.getPrescriptionById(prescriptionId);
        if (!prescription) {
            throw new Error("Prescription not found");
        }
        return prescription;
    }
    async updatePrescription(prescriptionId, data, actingRole) {
        const existing = await repository.getPrescriptionById(prescriptionId);
        if (!existing) {
            throw new Error("Prescription not found");
        }
        const nextStatus = data.status;
        if (nextStatus && nextStatus !== existing.prescription_status) {
            if (nextStatus === prescription_constants_1.PRESCRIPTION_STATUS.FINALIZED) {
                if (existing.prescription_status !== prescription_constants_1.PRESCRIPTION_STATUS.DRAFT) {
                    throw new Error("Only a draft prescription can be finalized");
                }
            }
            else if (nextStatus === prescription_constants_1.PRESCRIPTION_STATUS.DRAFT) {
                if (existing.prescription_status !== prescription_constants_1.PRESCRIPTION_STATUS.FINALIZED) {
                    throw new Error("Only a finalized prescription can be reopened");
                }
                // The JWT payload only carries the caller's role today (see
                // auth.middleware.ts), so "authorized doctor" is enforced on role.
                if (actingRole !== "DOCTOR") {
                    throw new Error("Only a doctor can reopen a finalized prescription");
                }
            }
            else if (nextStatus === prescription_constants_1.PRESCRIPTION_STATUS.CANCELLED) {
                if (existing.prescription_status === prescription_constants_1.PRESCRIPTION_STATUS.CANCELLED) {
                    throw new Error("Prescription is already cancelled");
                }
            }
            else {
                throw new Error("Invalid prescription status");
            }
        }
        else if (existing.prescription_status === prescription_constants_1.PRESCRIPTION_STATUS.FINALIZED) {
            throw new Error("Prescription is finalized and read-only. Reopen it before editing.");
        }
        else if (existing.prescription_status === prescription_constants_1.PRESCRIPTION_STATUS.CANCELLED) {
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
    async deletePrescription(prescriptionId) {
        const existing = await repository.getPrescriptionById(prescriptionId);
        if (!existing) {
            throw new Error("Prescription not found");
        }
        if (existing.prescription_status === prescription_constants_1.PRESCRIPTION_STATUS.CANCELLED) {
            throw new Error("Prescription is already cancelled");
        }
        return repository.updatePrescription(prescriptionId, {
            prescription_status: prescription_constants_1.PRESCRIPTION_STATUS.CANCELLED
        });
    }
    async getPrescriptionItems(prescriptionId) {
        const existing = await repository.getPrescriptionById(prescriptionId);
        if (!existing) {
            throw new Error("Prescription not found");
        }
        return repository.getPrescriptionItems(prescriptionId);
    }
    async addPrescriptionItem(prescriptionId, data) {
        const existing = await repository.getPrescriptionById(prescriptionId);
        if (!existing) {
            throw new Error("Prescription not found");
        }
        if (existing.prescription_status !== prescription_constants_1.PRESCRIPTION_STATUS.DRAFT) {
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
        return prisma_1.default.$transaction(async (tx) => {
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
                instruction: data.instruction
            });
        });
    }
    async updatePrescriptionItem(prescriptionId, itemId, data) {
        const existing = await repository.getPrescriptionById(prescriptionId);
        if (!existing) {
            throw new Error("Prescription not found");
        }
        if (existing.prescription_status !== prescription_constants_1.PRESCRIPTION_STATUS.DRAFT) {
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
            instruction: data.instruction
        });
    }
    async deletePrescriptionItem(prescriptionId, itemId) {
        const existing = await repository.getPrescriptionById(prescriptionId);
        if (!existing) {
            throw new Error("Prescription not found");
        }
        if (existing.prescription_status !== prescription_constants_1.PRESCRIPTION_STATUS.DRAFT) {
            throw new Error("Cannot remove items from a prescription that is not in draft status");
        }
        const item = await repository.findPrescriptionItem(prescriptionId, itemId);
        if (!item) {
            throw new Error("Prescription item not found");
        }
        return repository.deletePrescriptionItem(itemId);
    }
    async getSuggestedMedicines(diagnosisId) {
        const diagnosis = await repository.findDiagnosis(diagnosisId);
        if (!diagnosis) {
            throw new Error("Diagnosis not found");
        }
        return repository.getSuggestedMedicines(diagnosisId);
    }
    async getPrescriptionsByPatientHistoryId(patientHistoryId) {
        return repository.getPrescriptionsByPatientHistoryId(patientHistoryId);
    }
    async getPrescriptionsByPatientId(patientId, query) {
        return repository.getPrescriptionsByPatientId(patientId, query);
    }
}
exports.PrescriptionService = PrescriptionService;
