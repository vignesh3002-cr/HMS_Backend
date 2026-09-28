"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PriorityFlagsService = void 0;
const priorityFlags_repository_1 = require("./priorityFlags.repository");
const repository = new priorityFlags_repository_1.PriorityFlagsRepository();
function computeAge(dob, patientAge) {
    if (patientAge != null && patientAge > 0)
        return patientAge;
    if (!dob)
        return null;
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
        age--;
    }
    return age;
}
function hasAbnormalVitals(vitals) {
    if (vitals.systolic_bp != null && (vitals.systolic_bp > 180 || vitals.systolic_bp < 80))
        return true;
    if (vitals.diastolic_bp != null && (vitals.diastolic_bp > 120 || vitals.diastolic_bp < 50))
        return true;
    if (vitals.pulse != null && (vitals.pulse > 120 || vitals.pulse < 40))
        return true;
    if (vitals.temperature != null && (vitals.temperature > 39.5 || vitals.temperature < 35.0))
        return true;
    if (vitals.spo2 != null && vitals.spo2 < 90)
        return true;
    if (vitals.respiratory_rate != null && (vitals.respiratory_rate > 30 || vitals.respiratory_rate < 8))
        return true;
    return false;
}
function hasHighPainScore(painScore) {
    if (painScore == null)
        return false;
    return Number(painScore) >= 7;
}
function isClinicallyNotDoingWell(encounter, history) {
    const urgentKeywords = [
        "critical", "deteriorating", "unstable", "acute distress",
        "severe", "emergency", "code blue", "respiratory distress",
        "cardiac arrest", "sepsis", "shock", "hemorrhage",
        "requires urgent", "urgent attention", "immediate",
    ];
    const notes = [
        encounter.chief_complaint,
        encounter.clinical_notes,
        history?.history_of_present_illness,
        history?.clinical_notes,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    return urgentKeywords.some((kw) => notes.includes(kw));
}
class PriorityFlagsService {
    async getPriorityFlags(patientIds) {
        const result = {};
        if (patientIds.length === 0)
            return result;
        const [patients, encounters, histories] = await Promise.all([
            repository.findPatientsByIds(patientIds),
            repository.findLatestEncountersByPatientIds(patientIds),
            repository.findLatestPatientHistoryByPatientIds(patientIds),
        ]);
        const typedPatients = patients;
        const typedEncounters = encounters;
        const typedHistories = histories;
        const patientMap = new Map(typedPatients.map((p) => [p.patient_id, p]));
        const encounterMap = new Map(typedEncounters.map((e) => [e.patient_id, e]));
        const historyMap = new Map(typedHistories.map((h) => [h.patient_id, h]));
        for (const pid of patientIds) {
            const patient = patientMap.get(pid);
            const encounter = encounterMap.get(pid);
            const history = historyMap.get(pid);
            let flagged = false;
            // Age < 18 (Pediatric)
            const age = computeAge(patient?.patient_dob ?? null, patient?.patient_age ?? null);
            if (age != null && age < 18) {
                flagged = true;
            }
            // Age > 75 (Elderly)
            if (!flagged && age != null && age > 75) {
                flagged = true;
            }
            // Abnormal vitals from encounter
            if (!flagged && encounter) {
                flagged = hasAbnormalVitals(encounter);
            }
            // Abnormal vitals from history (map oxygen_saturation to spo2)
            if (!flagged && history) {
                flagged = hasAbnormalVitals({
                    systolic_bp: history.systolic_bp,
                    diastolic_bp: history.diastolic_bp,
                    pulse: history.pulse,
                    temperature: history.temperature,
                    spo2: history.oxygen_saturation,
                    respiratory_rate: history.respiratory_rate,
                });
            }
            // Pain score >= 7
            if (!flagged && encounter) {
                flagged = hasHighPainScore(encounter.pain_score);
            }
            if (!flagged && history) {
                flagged = hasHighPainScore(history.pain_score);
            }
            // Clinically not doing well
            if (!flagged && encounter) {
                flagged = isClinicallyNotDoingWell(encounter, history ?? null);
            }
            result[pid] = flagged;
        }
        return result;
    }
}
exports.PriorityFlagsService = PriorityFlagsService;
