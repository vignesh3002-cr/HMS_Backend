// A medicine from medicine_master, or - for a drug name the doctor typed
// on the chemotherapy order - no medicine_id and a free-text drug_name.
export interface MedicineItemDto {
    medicine_id?: string | null;
    drug_name?: string | null;
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
    drug_role?: string;
    drug_type?: string;
    /* The chemotherapy plan cycle day / order this item was prescribed from. */
    chemotherapy_plan_id?: string;
    plan_order_id?: string;
    plan_item_id?: string;
    cycle_number?: number;
    cycle_day?: number;
}

export interface CreatePrescriptionDto {
    encounter_no: string;
    diagnosis_id?: string;
    visit_type?: string;
    chief_complaint?: string;
    clinical_notes?: string;
    advice?: string;
    followup_date?: string;
    /* The visit's intended prescription kind. Defaults to CHEMOTHERAPY for
       clinical-role items and ADVICE when every item is an Advice row. */
    prescription_type?: "ADVICE" | "CHEMOTHERAPY" | "GENERAL";
    /* Lock the visit's prescription once this submit completes. */
    finalize?: boolean;
    /* Also finalize the encounter's other DRAFT prescriptions (the Advice
       one) so one Submit leaves every prescription of the visit locked. */
    finalize_encounter?: boolean;
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
    medicine_id?: string | null;
    drug_name?: string | null;
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
    drug_role?: string;
    drug_type?: string;
}

export interface SearchMedicinesQuery {
    search?: string;
    limit?: number;
}

export interface CreateMedicineDto {
    medicine_name: string;
    dosage_form?: string;
    unit?: string;
    strength?: string;
}

export interface GetPrescriptionsQuery {
    branchId?: string;
    doctorId?: string;
    patientHistoryId?: string;
    appointmentId?: string;
    encounterNo?: string;
    prescriptionType?: string;
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
    patientId?: string;
}
