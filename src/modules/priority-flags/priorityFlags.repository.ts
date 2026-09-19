import prisma from "../../config/prisma";
import { Prisma } from "@prisma/client";

export class PriorityFlagsRepository {
  async findPatientsByIds(patientIds: string[]) {
    return prisma.patient_bio_data.findMany({
      where: { patient_id: { in: patientIds } },
      select: {
        patient_id: true,
        patient_dob: true,
        patient_age: true,
      },
    });
  }

  async findLatestEncountersByPatientIds(patientIds: string[]) {
    if (patientIds.length === 0) return [];

    const encounters = await prisma.$queryRaw<
      Array<{
        patient_id: string;
        encounter_no: string;
        pain_score: bigint | null;
        systolic_bp: number | null;
        diastolic_bp: number | null;
        pulse: number | null;
        temperature: number | null;
        spo2: number | null;
        respiratory_rate: number | null;
        height: number | null;
        weight: number | null;
        chief_complaint: string | null;
        clinical_notes: string | null;
        encounter_ts: Date;
      }>
    >`
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

  async findLatestPatientHistoryByPatientIds(patientIds: string[]) {
    if (patientIds.length === 0) return [];

    const histories = await prisma.$queryRaw<
      Array<{
        patient_id: string;
        pain_score: bigint | null;
        systolic_bp: number | null;
        diastolic_bp: number | null;
        pulse: number | null;
        temperature: number | null;
        oxygen_saturation: number | null;
        respiratory_rate: number | null;
        severity: bigint | null;
        clinical_notes: string | null;
        history_of_present_illness: string | null;
        visit_date: Date | null;
      }>
    >`
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
