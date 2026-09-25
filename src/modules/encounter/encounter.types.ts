export interface CreateEncounterDTO {
    createdBy: string;
    appointment_id: string;

}

export interface CreateIpdEncounterDTO {
    createdBy: string;
    admission_id: string;

}

export interface UpdateEncounterDTO {

    chief_complaint?: string;
    symptoms?: string;
    diagnosis_id?: string;
    clinical_notes?: string;
    advice?: string;
    follow_up_date?: string; // YYYY-MM-DD

    // Consultation Summary clinical findings (added per EMR master spec).
    history_of_present_illness?: string;
    cns_examination?: string;
    cvs_examination?: string;
    per_abdomen_examination?: string;
    clinical_findings?: string;
    respiratory_examination?: string;
    general_examination_icterus?: boolean;
    general_examination_pallor?: boolean;
    general_examination_clubbing?: boolean;
    general_examination_cyanosis?: boolean;
    general_examination_oedema?: boolean;
    general_examination_lymphadenopathy?: boolean;

    // Past History treatment details + previous reports free text.
    past_history_treatment_type?: string;
    past_history_treatment_date?: string; // YYYY-MM-DD
    past_history_treatment_note?: string;
    past_history_treatment_response?: string;
    previous_reports?: string;

    // Consultation > Advice > Discussion: the doctor's remarks for the visit.
    notes?: string;

    height?: number;
    weight?: number;
    pulse?: number;
    systolic_bp?: number;
    diastolic_bp?: number;
    temperature?: number;
    respiratory_rate?: number;
    spo2?: number;
    blood_sugar?: number;
    pain_score?: number;

}

export interface GetEncountersQuery {

    branchId?: string;
    doctorId?: string;
    patientId?: string;
    appointmentId?: string;
    status?: string;
    encounterType?: string;

    date?: string;
    dateFrom?: string;
    dateTo?: string;

    search?: string;

    sortBy?: "encounter_ts" | "created_at" | "status";
    sortOrder?: "asc" | "desc";

    page?: number;
    limit?: number;

}
