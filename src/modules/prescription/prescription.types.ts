export interface CreatePrescriptionItemDTO {

    medicine_id: string;
    dosage?: string;
    unit?: string;
    route?: string;
    frequency?: string;
    before_after_food?: string;
    morning?: boolean;
    afternoon?: boolean;
    night?: boolean;
    days?: number;
    duration?: string;
    quantity?: number;
    instruction?: string;

}

export interface CreatePrescriptionDTO {

    encounter_no: string;
    diagnosis_id?: string;
    visit_type?: string;
    chief_complaint?: string;
    clinical_notes?: string;
    advice?: string;
    followup_date?: string; // YYYY-MM-DD
    medicines: CreatePrescriptionItemDTO[];

}

export interface UpdatePrescriptionDTO {

    diagnosis_id?: string;
    chief_complaint?: string;
    clinical_notes?: string;
    advice?: string;
    followup_date?: string; // YYYY-MM-DD
    status?: "DRAFT" | "FINALIZED" | "CANCELLED";

}

export interface UpdatePrescriptionItemDTO {

    medicine_id?: string;
    dosage?: string;
    unit?: string;
    route?: string;
    frequency?: string;
    before_after_food?: string;
    morning?: boolean;
    afternoon?: boolean;
    night?: boolean;
    days?: number;
    duration?: string;
    quantity?: number;
    instruction?: string;

}

export interface GetPrescriptionsQuery {

    branchId?: string;
    doctorId?: string;
    patientHistoryId?: string;
    appointmentId?: string;
    diagnosisId?: string;
    status?: string;

    date?: string;
    dateFrom?: string;
    dateTo?: string;

    search?: string;

    sortBy?: "prescription_date" | "created_at" | "status";
    sortOrder?: "asc" | "desc";

    page?: number;
    limit?: number;

}
