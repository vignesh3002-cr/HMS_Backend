"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPatientDiagnoses = buildPatientDiagnoses;
const prisma_1 = __importDefault(require("../../config/prisma"));
/* ---------------------------------------------------------------------------
   Patient diagnosis aggregation for the admin Patients page.

   A patient can carry 1..n diagnoses, so the API returns a LIST instead of the
   old single value. Two sources contribute (decided with the product owner):

     1. chemotherapy_plan   - EVERY plan (open AND completed/discontinued);
                              previously only the open plan counted, which hid
                              diagnoses of finished treatments (e.g. PAT027).
     2. oncology_staging_detail - every staging record (the real multi-diagnosis
                              source: one record per staged cancer site).

   Admissions / encounters / appointments / prescriptions are deliberately NOT
   used: their diagnosis columns are free text and currently hold visit reasons
   ("Emergency Admit", "Day Care") rather than real diagnoses.

   Identity / de-duplication:
     - both sources always carry `cancer_type_id`, and it is the same FK on
       either side, so it is the primary key; `diagnosis_id` and finally the
       lower-cased display name are the fallbacks for rows missing it;
     - the display name prefers the `cancer_types` master ("Breast") so a plan's
       `cancer_type` and a staging row resolving to "Breast Cancer" collapse into
       ONE entry instead of looking like two diseases;
     - the first occurrence wins because rows are fed in priority order
       (open plan -> other plans -> staging), which keeps the primary diagnosis
       exactly where the old single-value column pointed.

   Ordering: open plan first, then the remaining plans (newest first), then
   staging records (newest first).
--------------------------------------------------------------------------- */
const OPEN_PLAN_STATUSES = new Set(["ACTIVE", "PLANNED"]);
const normalizeKey = (value) => value.trim().toLowerCase();
/**
 * Builds patient_id -> ordered, de-duplicated diagnosis display names.
 * Returns an empty map when `patientIds` is empty (no queries are issued).
 */
async function buildPatientDiagnoses(patientIds) {
    const diagnosesByPatient = new Map();
    const ids = [...new Set(patientIds.filter((id) => Boolean(id)))];
    if (ids.length === 0) {
        return diagnosesByPatient;
    }
    const [plans, staging] = await Promise.all([
        prisma_1.default.chemotherapy_plan.findMany({
            where: { patient_id: { in: ids } },
            select: {
                patient_id: true,
                cancer_type: true,
                cancer_type_id: true,
                diagnosis_id: true,
                treatment_status: true,
                created_at: true,
            },
            orderBy: { created_at: "desc" },
        }),
        prisma_1.default.oncology_staging_detail.findMany({
            where: { patient_id: { in: ids } },
            select: {
                patient_id: true,
                cancer_type_id: true,
                diagnosis_id: true,
                created_at: true,
            },
            orderBy: { created_at: "desc" },
        }),
    ]);
    const cancerTypeIds = [
        ...new Set([...plans, ...staging]
            .map((row) => row.cancer_type_id)
            .filter((id) => Boolean(id))),
    ];
    const diagnosisIds = [
        ...new Set([...plans, ...staging]
            .map((row) => row.diagnosis_id)
            .filter((id) => Boolean(id))),
    ];
    const [cancerTypes, diagnosisCatalog] = await Promise.all([
        cancerTypeIds.length > 0
            ? prisma_1.default.cancer_types.findMany({
                where: { cancer_type_id: { in: cancerTypeIds } },
                select: { cancer_type_id: true, cancer_type: true },
            })
            : Promise.resolve([]),
        diagnosisIds.length > 0
            ? prisma_1.default.diagnosis.findMany({
                where: { diagnosis_id: { in: diagnosisIds } },
                select: { diagnosis_id: true, diagnosis_name: true },
            })
            : Promise.resolve([]),
    ]);
    const cancerTypeName = new Map(cancerTypes.map((c) => [c.cancer_type_id, c.cancer_type]));
    const diagnosisName = new Map(diagnosisCatalog.map((d) => [d.diagnosis_id, d.diagnosis_name]));
    const displayName = (row) => {
        if (row.cancer_type_id) {
            const name = cancerTypeName.get(row.cancer_type_id);
            if (name)
                return name;
        }
        if (row.diagnosis_id) {
            const name = diagnosisName.get(row.diagnosis_id);
            if (name)
                return name;
        }
        return row.cancer_type?.trim() || null;
    };
    // Priority order: open plans -> other plans -> staging (each newest first).
    const ordered = [
        ...plans.filter((p) => OPEN_PLAN_STATUSES.has(p.treatment_status ?? "")),
        ...plans.filter((p) => !OPEN_PLAN_STATUSES.has(p.treatment_status ?? "")),
        ...staging,
    ];
    const keysByPatient = new Map();
    for (const row of ordered) {
        const name = displayName(row);
        if (!name)
            continue;
        const key = normalizeKey(row.cancer_type_id ?? row.diagnosis_id ?? name);
        let entries = keysByPatient.get(row.patient_id);
        if (!entries) {
            entries = new Map();
            keysByPatient.set(row.patient_id, entries);
        }
        if (!entries.has(key)) {
            entries.set(key, name);
        }
    }
    for (const [patientId, entries] of keysByPatient) {
        diagnosesByPatient.set(patientId, [...entries.values()]);
    }
    return diagnosesByPatient;
}
