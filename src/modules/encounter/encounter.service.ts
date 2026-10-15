import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import prisma from "../../config/prisma";
import { EncounterRepository } from "./encounter.repository";
import { CreateEncounterDTO, CreateIpdEncounterDTO, UpdateEncounterDTO, GetEncountersQuery } from "./encounter.types";
import { ENCOUNTER_STATUS, ENCOUNTER_TYPE_DEFAULT, ENCOUNTER_TYPE_IPD } from "./encounter.constants";
import { APPOINTMENT_STATUS, TERMINAL_APPOINTMENT_STATUSES } from "../appointment/appointment.constants";
import { generateId } from "../../utils/idGenerator";
import { TOP_LEVEL_ADMIN_ROLES } from "../../permissions/roles";
import { IPD_STATUS } from "../ipd/ipd.types";

const repository = new EncounterRepository();

export class EncounterService {

    async createEncounter(data: CreateEncounterDTO, createdBy: string) {

        const appointment = await repository.findAppointmentForEncounter(
            data.appointment_id
        );

        if (!appointment) {
            throw new Error("Appointment not found");
        }

        /*
         * Allow encounters to be created for terminal status appointments
         * except CHECKED_IN, which should already have an encounter or be
         * transitioning to IN_CONSULTATION.
         */
        const blockingStatuses = TERMINAL_APPOINTMENT_STATUSES;

        if (blockingStatuses.includes(appointment.status ?? "")) {
            throw new Error(
                `Cannot create an encounter for an appointment that is already ${appointment.status}`
            );
        }

        const patient = appointment.patient_bio_data;

        if (!patient) {
            throw new Error("Patient not found");
        }

        if (patient.patient_active !== "Active") {
            throw new Error("Patient is inactive");
        }

        const doctor = appointment.employees;

        if (!doctor || !doctor.employee_id) {
            throw new Error("Doctor not found");
        }

        if (doctor.user_table?.role_type !== "DOCTOR") {
            throw new Error("Assigned employee is not a doctor");
        }

        if (doctor.emp_status !== true) {
            throw new Error("Doctor is inactive");
        }

        const branch = appointment.branch;

        if (!branch || !appointment.branch_id) {
            throw new Error("Branch not found");
        }

        if (branch.branch_status !== "Active") {
            throw new Error("Branch is inactive");
        }

        const mapping = await repository.findDoctorBranchMapping(
            doctor.employee_id,
            appointment.branch_id
        );

        if (!mapping) {
            throw new Error("Doctor is not assigned to the appointment's branch");
        }

        /*
         * schedule_id is deliberately NOT enforced here. Appointments can
         * legitimately lose their original schedule after booking (schedule
         * OVERRIDE/CANCEL closes old schedules, off-day bookings have none),
         * and encounter.schedule_id is nullable in the schema. Blocking
         * clinical flow because a schedule disappeared only strands the
         * appointment in IN_CONSULTATION with no encounter.
         */

        const existingEncounter = await repository.findEncounterByAppointmentId(
            data.appointment_id
        );

        if (existingEncounter) {

            /*
             * Recording vitals before the doctor's check-in already opens
             * the visit's encounter. Checking in then only moves the
             * appointment into consultation - left SCHEDULED it is never
             * counted as checked in, and the nightly sweep turns it into
             * NO_SHOW.
             */
            const awaitingConsultation: string[] = [
                APPOINTMENT_STATUS.SCHEDULED,
                APPOINTMENT_STATUS.RESCHEDULED,
                APPOINTMENT_STATUS.CHECKED_IN
            ];

            if (awaitingConsultation.includes(appointment.status ?? "")) {

                return prisma.$transaction(async (tx) => {

                    await repository.updateAppointmentStatus(
                        tx,
                        appointment.appointment_id,
                        APPOINTMENT_STATUS.IN_CONSULTATION
                    );

                    await tx.appointment_notification.create({
                        data: {
                            notification_id: await generateId(tx, "NOTIFICATION"),
                            appointment_id: appointment.appointment_id,
                            channel: "IN_APP",
                            notification_type: "CHECKIN",
                            recipient: doctor.employee_id!,
                            status: "UNREAD"
                        }
                    });

                    return existingEncounter;

                });

            }

            throw new Error("Encounter already exists for this appointment");
        }

        try {

            return await prisma.$transaction(async (tx) => {

                const encounterNo = await repository.generateEncounterNumber(tx);

                const encounter = await repository.createEncounter(tx, {
                    createdBy: createdBy,
                    encounter_no: encounterNo,
                    patient_id: appointment.patient_id,
                    branch_id: appointment.branch_id!,
                    department_id: appointment.department_id,
                    appointment_id: appointment.appointment_id,
                    employee_id: doctor.employee_id!,
                    schedule_id: appointment.schedule_id,
                    encounter_type: appointment.Patient_type ?? ENCOUNTER_TYPE_DEFAULT,
                    status: ENCOUNTER_STATUS.OPEN

                });

                await repository.updateAppointmentStatus(
                    tx,
                    appointment.appointment_id,
                    APPOINTMENT_STATUS.IN_CONSULTATION
                );

                /*
                 * In-app notification for the doctor whose
                 * patient just checked in.
                 */
                await tx.appointment_notification.create({
                    data: {
                        notification_id: await generateId(
                            tx,
                            "NOTIFICATION"
                        ),
                        appointment_id: appointment.appointment_id,
                        channel: "IN_APP",
                        notification_type: "CHECKIN",
                        recipient: doctor.employee_id!,
                        status: "UNREAD"
                    }
                });

                return encounter;

            });

        } catch (error: any) {

            // Guards against two concurrent requests both passing the
            // pre-check above and racing to create the same encounter -
            // the DB's unique constraint on appointment_id is the real guard.
            if (error?.code === "P2002") {
                throw new Error("Encounter already exists for this appointment");
            }

            throw error;

        }

    }

    async createIpEncounter(data: CreateIpdEncounterDTO, createdBy: string) {

        const admission = await repository.findAdmissionForEncounter(
            data.admission_id
        );

        if (!admission) {
            throw new Error("Admission not found");
        }

        if (admission.status !== IPD_STATUS.ADMITTED) {
            throw new Error("Encounter can only be started for an admitted patient");
        }

        const patient = admission.patient_bio_data;

        if (!patient) {
            throw new Error("Patient not found");
        }

        if (patient.patient_active !== "Active") {
            throw new Error("Patient is inactive");
        }

        const doctor = admission.employees;

        if (!doctor || !doctor.employee_id) {
            throw new Error("Doctor not found");
        }

        if (doctor.user_table?.role_type !== "DOCTOR") {
            throw new Error("Assigned employee is not a doctor");
        }

        if (doctor.emp_status !== true) {
            throw new Error("Doctor is inactive");
        }

        const branch = admission.branch;

        if (!branch || !admission.branch_id) {
            throw new Error("Branch not found");
        }

        if (branch.branch_status !== "Active") {
            throw new Error("Branch is inactive");
        }

        const mapping = await repository.findDoctorBranchMapping(
            doctor.employee_id,
            admission.branch_id
        );

        if (!mapping) {
            throw new Error("Doctor is not assigned to the admission's branch");
        }

        if (admission.encounter_no) {
            throw new Error("Encounter already exists for this admission");
        }

        return prisma.$transaction(async (tx) => {

            const encounterNo = await repository.generateEncounterNumber(tx);

            const encounter = await repository.createEncounter(tx, {
                createdBy: createdBy,
                encounter_no: encounterNo,
                patient_id: admission.patient_id,
                branch_id: admission.branch_id,
                department_id: admission.department_id,
                employee_id: doctor.employee_id!,
                encounter_type: ENCOUNTER_TYPE_IPD,
                status: ENCOUNTER_STATUS.OPEN

            });

            await repository.updateAdmissionEncounterNo(
                tx,
                admission.admission_id,
                encounterNo
            );

            return encounter;

        });

    }

    async getEncounters(query: GetEncountersQuery) {

        return repository.getEncounters(query);

    }

    async getCheckedInPatientsToday(employeeId?: string, branchId?: string) {

        return repository.getCheckedInPatientsToday(employeeId, branchId);

    }

    async getEncounterByNumber(encounterNo: string) {

        const encounter = await repository.getEncounterByNumber(encounterNo);

        if (!encounter) {
            throw new Error("Encounter not found");
        }

        return encounter;

    }

    /*
     * Selection-independent lookup for clinical flows (e.g. doctor
     * patient-consultation). Deliberately NOT behind branchScope: a doctor
     * mapped to multiple branches with no active selection would get 403 on
     * every scoped list query, even though the encounter itself belongs to
     * one of their branches. Isolation is preserved by checking the caller's
     * ACTIVE branch mappings against the encounter's own branch instead of
     * trusting whatever branch the UI happens to have selected.
     */
    async getEncounterByAppointmentId(appointmentId: string, userId: string, role: string) {

        const encounter = await repository.findEncounterByAppointmentId(appointmentId);

        if (!encounter) {
            const notFound: any = new Error("Encounter not found for this appointment");
            notFound.status = 404;
            throw notFound;
        }

        const isTopLevelAdmin = TOP_LEVEL_ADMIN_ROLES.some(
            (r) => r.toLowerCase() === String(role ?? "").toLowerCase()
        );

        if (!isTopLevelAdmin) {

            const mappings = await repository.findActiveBranchMappingsForUser(userId);

            const hasAccess = mappings.some(
                (m) => String(m.branch_id) === String(encounter.branch_id)
            );

            if (!hasAccess) {
                const forbidden: any = new Error("Forbidden. You don't have access to this branch.");
                forbidden.status = 403;
                throw forbidden;
            }

        }

        const details = await repository.getEncounterByNumber(encounter.encounter_no);

        if (!details) {
            const notFound: any = new Error("Encounter not found");
            notFound.status = 404;
            throw notFound;
        }

        return details;

    }

    /*
     * Latest-encounters feed for the patient vitals panel. Deliberately NOT
     * behind branchScope: the panel must show the freshest vitals regardless
     * of which branch recorded them or which branch the UI has selected.
     * Isolation mirrors getEncounterByAppointmentId - top-level admins see
     * every branch, everyone else is limited to their ACTIVE
     * user_branch_mapping branches (no mappings yields an empty list instead
     * of a 403 so the panel renders its empty state).
     */
    async getLatestEncountersForPatient(
        patientId: string,
        userId: string,
        role: string,
        limit?: number
    ) {

        const clampedLimit = Math.min(Math.max(limit ?? 10, 1), 50);

        const isTopLevelAdmin = TOP_LEVEL_ADMIN_ROLES.some(
            (r) => r.toLowerCase() === String(role ?? "").toLowerCase()
        );

        if (isTopLevelAdmin) {
            return repository.findRecentEncountersByPatient(patientId, null, clampedLimit);
        }

        const mappings = await repository.findActiveBranchMappingsForUser(userId);

        const branchIds = mappings.map((m) => String(m.branch_id));

        if (branchIds.length === 0) {
            return [];
        }

        return repository.findRecentEncountersByPatient(patientId, branchIds, clampedLimit);

    }

    async updateEncounter(encounterNo: string, data: UpdateEncounterDTO) {

        const existing = await repository.getEncounterByNumber(encounterNo);

        if (!existing) {
            throw new Error("Encounter not found");
        }

        if (existing.status !== ENCOUNTER_STATUS.OPEN) {
            throw new Error("Cannot update an encounter that is not OPEN");
        }

        if (data.diagnosis_id) {

            const diagnosis = await repository.findDiagnosis(data.diagnosis_id);

            if (!diagnosis) {
                throw new Error("Diagnosis not found");
            }

        }

        // Recompute BMI whenever height or weight changes, mirroring
        // createPatientHistory's formula (kg / m^2).
        let bmi: number | null | undefined;
        if (data.height !== undefined || data.weight !== undefined) {
            const finalHeight = data.height ?? (existing.height === null ? null : Number(existing.height));
            const finalWeight = data.weight ?? (existing.weight === null ? null : Number(existing.weight));
            bmi = finalHeight && finalWeight && finalHeight > 0
                ? Math.round((finalWeight / Math.pow(finalHeight / 100, 2)) * 10) / 10
                : null;
        }

        // ── Inpatient (IPD) vitals history logging ──
        let vitalsLogUpdate: any = undefined;
        if (existing.encounter_type === ENCOUNTER_TYPE_IPD) {
            const hasAnyVital = [
                data.systolic_bp,
                data.diastolic_bp,
                data.pulse,
                data.respiratory_rate,
                data.spo2,
                data.temperature,
                data.height,
                data.weight,
                data.blood_sugar,
                data.pain_score,
            ].some((v) => v !== undefined && v !== null);

            if (hasAnyVital) {
                const entry = {
                    entry_id: randomUUID(),
                    recorded_at: new Date().toISOString(),
                    recorded_by: data.updatedBy ?? null,
                    systolic_bp: data.systolic_bp ?? null,
                    diastolic_bp: data.diastolic_bp ?? null,
                    pulse: data.pulse ?? null,
                    respiratory_rate: data.respiratory_rate ?? null,
                    spo2: data.spo2 ?? null,
                    temperature: data.temperature ?? null,
                    height: data.height ?? null,
                    weight: data.weight ?? null,
                    bmi: bmi ?? null,
                    blood_sugar: data.blood_sugar ?? null,
                    pain_score: data.pain_score ?? null,
                    remarks: data.remarks ?? null,
                };
                const existingLog = Array.isArray(existing.vitals_log)
                    ? (existing.vitals_log as any[])
                    : [];
                vitalsLogUpdate = [...existingLog, entry];
            }
        }

        const updated = await repository.updateEncounter(encounterNo, {

            chief_complaint: data.chief_complaint,
            symptoms: data.symptoms,
            diagnosis_id: data.diagnosis_id,
            clinical_notes: data.clinical_notes,
            advice: data.advice,
            // null clears the date; left out keeps it.
            follow_up_date: data.follow_up_date === null
                ? null
                : data.follow_up_date
                    ? new Date(data.follow_up_date)
                    : undefined,

            history_of_present_illness: data.history_of_present_illness,
            cns_examination: data.cns_examination,
            cvs_examination: data.cvs_examination,
            per_abdomen_examination: data.per_abdomen_examination,
            clinical_findings: data.clinical_findings,
            respiratory_examination: data.respiratory_examination,
            general_examination_icterus: data.general_examination_icterus,
            general_examination_pallor: data.general_examination_pallor,
            general_examination_clubbing: data.general_examination_clubbing,
            general_examination_cyanosis: data.general_examination_cyanosis,
            general_examination_oedema: data.general_examination_oedema,
            general_examination_lymphadenopathy:
                data.general_examination_lymphadenopathy,
            general_examination_others:
                data.general_examination_others === undefined
                    ? undefined
                    : data.general_examination_others === null
                        ? Prisma.JsonNull
                        : data.general_examination_others,

            past_history_treatment_type: data.past_history_treatment_type,
            past_history_treatment_date: data.past_history_treatment_date
                ? new Date(data.past_history_treatment_date)
                : undefined,
            past_history_treatment_note: data.past_history_treatment_note,
            past_history_treatment_response: data.past_history_treatment_response,
            previous_reports: data.previous_reports,
            notes: data.notes,

            height: data.height,
            weight: data.weight,
            pulse: data.pulse,
            systolic_bp: data.systolic_bp,
            diastolic_bp: data.diastolic_bp,
            temperature: data.temperature,
            respiratory_rate: data.respiratory_rate,
            spo2: data.spo2,
            blood_sugar: data.blood_sugar,
            pain_score: data.pain_score,

            ...(bmi !== undefined ? { BMI: bmi } : {}),
            ...(vitalsLogUpdate !== undefined ? { vitals_log: vitalsLogUpdate } : {})

        });

        // An inpatient encounter's Next Visit Date (Follow Up step) is the
        // stay's review date -- one source, so the discharge details,
        // admin popup and History tab always show the same date.
        if (data.follow_up_date) {
            await prisma.admission.updateMany({
                where: { encounter_no: encounterNo, status: "ADMITTED" },
                data: { review_date: new Date(data.follow_up_date), updated_at: new Date() },
            });
        }

        return updated;

    }

    async closeEncounter(encounterNo: string, closedBy: string) {

        const existing = await repository.getEncounterByNumber(encounterNo);

        if (!existing) {
            throw new Error("Encounter not found");
        }

        if (existing.status !== ENCOUNTER_STATUS.OPEN) {
            throw new Error("Encounter is already closed");
        }

        /*
         * An admitted patient's IPD encounter stays open for the whole stay
         * and is closed by IPD discharge (which records discharge type and
         * summary and releases the bed). Closing it here used to discharge
         * the patient silently, so it is refused instead.
         */
        const activeAdmission = await prisma.admission.findFirst({
            where: { encounter_no: encounterNo, status: IPD_STATUS.ADMITTED },
            select: { ip_number: true },
        });

        if (activeAdmission) {
            throw new Error(
                `This encounter belongs to admitted patient IP ${activeAdmission.ip_number}. Discharge the patient from In-Patient Admissions instead.`
            );
        }

        return prisma.$transaction(async (tx) => {

            const closedAt = new Date();

            const encounter = await repository.closeEncounter(tx, encounterNo, {
                status: ENCOUNTER_STATUS.CLOSED,
                checkout_time: closedAt,
                closed_by: closedBy,
                closed_at: closedAt
            });

            if (existing.appointment_id) {

                await repository.updateAppointmentStatus(
                    tx,
                    existing.appointment_id,
                    APPOINTMENT_STATUS.COMPLETED
                );

            }

            return encounter;

        });

    }

    async updateVitalsLogEntry(
        encounterNo: string,
        entryId: string,
        data: {
            systolic_bp?: number;
            diastolic_bp?: number;
            pulse?: number;
            respiratory_rate?: number;
            spo2?: number;
            temperature?: number;
            height?: number;
            weight?: number;
            blood_sugar?: number;
            pain_score?: number;
            remarks?: string;
            updatedBy?: string;
        }
    ) {
        const existing = await repository.getEncounterByNumber(encounterNo);
        if (!existing) {
            throw new Error("Encounter not found");
        }

        const logs = Array.isArray(existing.vitals_log) ? (existing.vitals_log as any[]) : [];
        const idx = logs.findIndex((e) => (e.entry_id ?? e.recorded_at) === entryId);
        if (idx === -1) {
            throw new Error("Vitals entry not found");
        }

        const finalHeight = data.height !== undefined ? data.height : logs[idx].height;
        const finalWeight = data.weight !== undefined ? data.weight : logs[idx].weight;
        const bmi =
            finalHeight && finalWeight && Number(finalHeight) > 0
                ? Math.round((Number(finalWeight) / Math.pow(Number(finalHeight) / 100, 2)) * 10) / 10
                : null;

        logs[idx] = {
            ...logs[idx],
            ...(data.systolic_bp !== undefined ? { systolic_bp: data.systolic_bp } : {}),
            ...(data.diastolic_bp !== undefined ? { diastolic_bp: data.diastolic_bp } : {}),
            ...(data.pulse !== undefined ? { pulse: data.pulse } : {}),
            ...(data.respiratory_rate !== undefined ? { respiratory_rate: data.respiratory_rate } : {}),
            ...(data.spo2 !== undefined ? { spo2: data.spo2 } : {}),
            ...(data.temperature !== undefined ? { temperature: data.temperature } : {}),
            ...(data.height !== undefined ? { height: data.height } : {}),
            ...(data.weight !== undefined ? { weight: data.weight } : {}),
            ...(data.blood_sugar !== undefined ? { blood_sugar: data.blood_sugar } : {}),
            ...(data.pain_score !== undefined ? { pain_score: data.pain_score } : {}),
            ...(data.remarks !== undefined ? { remarks: data.remarks } : {}),
            bmi,
            updated_at: new Date().toISOString(),
            updated_by: data.updatedBy ?? null,
        };

        // Sort to find newest entry and sync flat columns
        const sorted = [...logs].sort(
            (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
        );
        const latest = sorted[0];

        return repository.updateEncounter(encounterNo, {
            vitals_log: logs,
            systolic_bp: latest.systolic_bp ?? null,
            diastolic_bp: latest.diastolic_bp ?? null,
            pulse: latest.pulse ?? null,
            temperature: latest.temperature ?? null,
            spo2: latest.spo2 ?? null,
            respiratory_rate: latest.respiratory_rate ?? null,
            height: latest.height ?? null,
            weight: latest.weight ?? null,
            blood_sugar: latest.blood_sugar ?? null,
            pain_score: latest.pain_score ?? null,
            BMI: latest.bmi ?? null,
        });
    }

    async deleteVitalsLogEntry(encounterNo: string, entryId: string) {
        const existing = await repository.getEncounterByNumber(encounterNo);
        if (!existing) {
            throw new Error("Encounter not found");
        }

        const logs = Array.isArray(existing.vitals_log) ? (existing.vitals_log as any[]) : [];
        const filtered = logs.filter((e) => (e.entry_id ?? e.recorded_at) !== entryId);

        // Sort remaining entries to find newest (or empty)
        const sorted = [...filtered].sort(
            (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
        );
        const latest = sorted[0] || {};

        return repository.updateEncounter(encounterNo, {
            vitals_log: filtered,
            systolic_bp: latest.systolic_bp ?? null,
            diastolic_bp: latest.diastolic_bp ?? null,
            pulse: latest.pulse ?? null,
            temperature: latest.temperature ?? null,
            spo2: latest.spo2 ?? null,
            respiratory_rate: latest.respiratory_rate ?? null,
            height: latest.height ?? null,
            weight: latest.weight ?? null,
            blood_sugar: latest.blood_sugar ?? null,
            pain_score: latest.pain_score ?? null,
            BMI: latest.bmi ?? null,
        });
    }

}
