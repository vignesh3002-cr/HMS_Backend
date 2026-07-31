export interface MedicineItemDto {
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

export interface CreatePrescriptionDto {
    encounter_no: string;
    diagnosis_id?: string;
    visit_type?: string;
    chief_complaint?: string;
    clinical_notes?: string;
    advice?: string;
    followup_date?: string;
    medicines: MedicineItemDto[];
}

export interface UpdatePrescriptionDto {
    diagnosis_id?: string;
    chief_complaint?: string;
    clinical_notes?: string;
    advice?: string;
    followup_date?: string;
    status?: string;
}

export interface AddPrescriptionItemDto extends MedicineItemDto {}

export interface UpdatePrescriptionItemDto {
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
    sortBy?: "created_at" | "status" | "prescription_date";
    sortOrder?: "asc" | "desc";
    page?: number;
    limit?: number;
}
