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

        return repository.updateEncounter(encounterNo, {

            chief_complaint: data.chief_complaint,
            symptoms: data.symptoms,
            diagnosis_id: data.diagnosis_id,
            clinical_notes: data.clinical_notes,
            advice: data.advice,
            follow_up_date: data.follow_up_date
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

            ...(bmi !== undefined ? { BMI: bmi } : {})

        });

    }

    async closeEncounter(encounterNo: string, closedBy: string) {

        const existing = await repository.getEncounterByNumber(encounterNo);

        if (!existing) {
            throw new Error("Encounter not found");
        }

        if (existing.status !== ENCOUNTER_STATUS.OPEN) {
            throw new Error("Encounter is already closed");
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

            // IPD discharge hook: if encounter has an associated active admission, close the IPD stay and release the bed
            const associatedAdmission = await tx.admission.findFirst({
                where: {
                    OR: [
                        { encounter_no: encounterNo },
                        ...(existing.appointment_id ? [{ appointment_id: existing.appointment_id }] : [])
                    ],
                    status: "ADMITTED"
                }
            });

            if (associatedAdmission) {
                await tx.admission.update({
                    where: { admission_id: associatedAdmission.admission_id },
                    data: {
                        status: "DISCHARGED",
                        discharge_date: closedAt,
                        updated_by: closedBy
                    }
                });

                if (associatedAdmission.bed_id) {
                    await tx.bed_master.update({
                        where: { bed_id: associatedAdmission.bed_id },
                        data: {
                            status: "AVAILABLE",
                            updated_by: closedBy,
                            updated_at: closedAt
                        }
                    });
                }
            }

            return encounter;

        });

    }

}
