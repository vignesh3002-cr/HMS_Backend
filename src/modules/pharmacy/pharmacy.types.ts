import { PharmacySlipStatus } from "./pharmacy.constants";

// A single medicine line as the plan resolves it. `dose` / `dose_unit` are the
// clinical dose the doctor ordered; `quantity` is the whole-pack count the
// pharmacy hands over. They are deliberately separate - the doctor's dose is
// not the quantity given to the patient.
export interface ResolvedMedicationLine {
    medicine_id?: string | null;
    // Display name. Generated from medicine_master.medicine_name via
    // medicine_id, or typed literally for a free-typed "Others" drug.
    drug_name?: string | null;
    brand_name?: string | null;
    dose?: string | null;
    dose_unit?: string | null;
    // Whole packs only; validated as a non-negative integer.
    quantity?: number | null;
    drug_role?: string | null;
    route?: string | null;
    frequency?: string | null;
    duration?: string | null;
    instructions?: string | null;
}

export interface ResolveContext {
    actingUserId: string;
}

// What resolving a plan yields: its lines plus the visit context the slip header
// stamps. Patient discharge medication is deferred - it is free text in
// encounter.advice today and needs its own table first.
export interface ResolvedSource {
    lines: ResolvedMedicationLine[];
    patient_id: string;
    branch_id: string;
    encounter_no?: string | null;
    appointment_id?: string | null;
    plan_order_id?: string | null;
    cycle_number?: number | null;
    cycle_day?: number | null;
    protocol_name?: string | null;
    regimen_name?: string | null;
}

// What a slip preview returns: resolved lines plus whichever persisted slip
// already covers this cycle day's order, so the page can show the slip that
// exists instead of silently resolving a different set of medicines.
export interface SlipPreview extends ResolvedSource {
    existing_slip?: PharmacySlipView | null;
}

export interface PharmacySlipItemView {
    pharmacy_slip_item_id: string;
    display_order: number;
    medicine_id: string | null;
    drug_name: string | null;
    brand_name: string | null;
    dose: string | null;
    dose_unit: string | null;
    quantity: number | null;
    drug_role: string | null;
    route: string | null;
    frequency: string | null;
    duration: string | null;
    instructions: string | null;
}

export interface PharmacySlipView {
    pharmacy_slip_id: string;
    patient_id: string;
    branch_id: string;
    encounter_no: string | null;
    appointment_id: string | null;
    plan_order_id: string | null;
    cycle_number: number | null;
    cycle_day: number | null;
    protocol_name: string | null;
    regimen_name: string | null;
    slip_status: PharmacySlipStatus | string;
    issued_at: Date | null;
    issued_by: string | null;
    printed_at: Date | null;
    printed_by: string | null;
    cancelled_at: Date | null;
    cancelled_by: string | null;
    cancellation_reason: string | null;
    created_by: string | null;
    created_at: Date | null;
    updated_at: Date | null;
    patient_bio_data?: {
        patient_id?: string;
        patient_first_name?: string | null;
        patient_last_name?: string | null;
    } | null;
    pharmacy_slip_item?: PharmacySlipItemView[];
}

export interface CreateSlipFromPlanDto {
    plan_id: string;
}

export interface UpdateSlipItemsDto {
    items: {
        pharmacy_slip_item_id: string;
        quantity?: number | null;
    }[];
}

export interface CancelSlipDto {
    reason: string;
}

export interface PrintSlipDto {
    // Optional: the pharmacy may reprint on behalf of someone else.
    printed_by?: string | null;
}

export interface GetSlipsQuery {
    branch_id?: string | null;
    patient_id?: string | null;
    encounter_no?: string | null;
    appointment_id?: string | null;
    cycle_number?: number | null;
    plan_id?: string | null;
    status?: string | null;
    date_from?: string | null;
    date_to?: string | null;
    search?: string | null;
    page?: number;
    limit?: number;
}