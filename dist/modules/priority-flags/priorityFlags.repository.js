"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PriorityFlagsRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
class PriorityFlagsRepository {
    async findPatientsByIds(patientIds) {
        return prisma_1.default.patient_bio_data.findMany({
            where: { patient_id: { in: patientIds } },
            select: {
                patient_id: true,
                patient_dob: true,
                patient_age: true,
            },
        });
    }
    async findLatestEncountersByPatientIds(patientIds) {
        if (patientIds.length === 0)
            return [];
        const encounters = await prisma_1.default.$queryRaw `
      SELECT DISTINCT ON (e.patient_id)
        e.patient_id,
        e.encounter_no,
        e.pain_score,
        e.systolic_bp,
        e.diastolic_bp,
        e.pulse,
        e.temperature,
        e.spo2,
        e.respiratory_rate,
        e.height,
        e.weight,
        e.chief_complaint,
        e.clinical_notes,
        e.encounter_ts
      FROM encounter e
      WHERE e.patient_id = ANY(${patientIds}::text[])
      ORDER BY e.patient_id, e.encounter_ts DESC
    `;
        return encounters;
    }
    async findLatestPatientHistoryByPatientIds(patientIds) {
        if (patientIds.length === 0)
            return [];
        const histories = await prisma_1.default.$queryRaw `
      SELECT DISTINCT ON (ph.patient_id)
        ph.patient_id,
        ph.severity AS pain_score,
        ph.systolic_bp,
        ph.diastolic_bp,
        ph.pulse,
        ph.temperature,
        ph.oxygen_saturation,
        ph.respiratory_rate,
        ph.severity,
        ph.clinical_notes,
        ph.history_of_present_illness,
        ph.visit_date
      FROM patient_history ph
      WHERE ph.patient_id = ANY(${patientIds}::text[])
      ORDER BY ph.patient_id, ph.visit_date DESC NULLS LAST
    `;
        return histories;
    }
}
exports.PriorityFlagsRepository = PriorityFlagsRepository;
