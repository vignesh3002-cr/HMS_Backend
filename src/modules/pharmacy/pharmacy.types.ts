import { PharmacySlipStatus } from "./pharmacy.constants";

// A single medicine line as the plan resolves it.
//
// `patient_dose` is the clinical dose the doctor ordered ("150 mg").
// `dose` / `dose_unit` are the brand strength the doctor picked in the
// Discharge Medication pharmacy slip ("120 mg").
// `quantity` is how many units of that strength are handed over, so the four
// test cases hold: 120 selected for a 150 patient with a 30 available adds a
// 30 row of 1, while a brand that only has 120 folds into 120 x 2.
export interface ResolvedMedicationLine {
    medicine_id?: string | null;
    // Display name. Generated from medicine_master.medicine_name via
    // medicine_id, or typed literally for a free-typed "Others" drug.
    drug_name?: string | null;
    brand_name?: string | null;
    dosage_form?: string | null;
    patient_dose?: string | null;
    dose?: string | null;
    dose_unit?: string | null;
    // Units of `dose`; validated as a non-negative integer.
    quantity?: number | null;
    drug_role?: string | null;
    route?: string | null;
    frequency?: string | null;
    duration?: string | null;
    instructions?: string | null;
    pharmacy_item_id?: string | null;
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
    dosage_form?: string | null;
    patient_dose?: string | null;
    dose: string | null;
    dose_unit: string | null;
    quantity: number | null;
    drug_role: string | null;
    route: string | null;
    frequency: string | null;
    duration: string | null;
    instructions: string | null;
    pharmacy_item_id?: string | null;
}

export interface PharmacyMasterItemView {
    pharmacy_item_id: string;
    medicine_id: string | null;
    generic_name?: string | null;
    generic_id?: string | null;
    item_name: string;
    brand_name: string | null;
    manufacturer_name: string | null;
    dosage_form: string | null;
    strength_text: string | null;
    strength_value: string | number | null;
    strength_unit: string | null;
}

export interface CreateMedicineDto {
    medicine_name: string;
    generic_name?: string | null;
    dosage_form?: string | null;
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
    amend_count: number;
    last_amended_at: Date | null;
    last_amended_by: string | null;
    last_amend_reason: string | null;
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

// One line of the Discharge Medication popup's save. It carries what the
// doctor chose per medicine: brand, strength, quantity and the patient dose
// the strength was matched against. The backend stores it verbatim so a
// reopened slip shows exactly what was dispensed.
export interface SlipOrderItemDto {
    medicine_id?: string | null;
    drug_name?: string | null;
    dosage_form?: string | null;
    patient_dose?: string | null;
    brand_name?: string | null;
    dose?: string | null;
    dose_unit?: string | null;
    quantity?: number | null;
    drug_role?: string | null;
    route?: string | null;
    frequency?: string | null;
    duration?: string | null;
    instructions?: string | null;
    pharmacy_item_id?: string | null;
}

// POST /pharmacy/slips/from-order - upsert the live slip of one cycle day.
export interface CreateSlipFromOrderDto {
    plan_id: string;
    cycle_number: number;
    cycle_day: number;
    encounter_no?: string | null;
    appointment_id?: string | null;
    items: SlipOrderItemDto[];
}

// GET /pharmacy/slips/by-order
export interface GetSlipByOrderQuery {
    plan_id: string;
    cycle_number: number;
    cycle_day: number;
}

export interface IssueSlipDto {
    note?: string | null;
}

export interface AmendSlipDto extends UpdateSlipItemsDto {
    reason: string;
}

export interface UpdateSlipItemsDto {
    items: {
        pharmacy_slip_item_id?: string;
        medicine_id?: string | null;
        drug_name?: string | null;
        brand_name?: string | null;
        dosage_form?: string | null;
        patient_dose?: string | null;
        dose?: string | null;
        dose_unit?: string | null;
        quantity?: number | null;
        drug_role?: string | null;
        route?: string | null;
        frequency?: string | null;
        duration?: string | null;
        instructions?: string | null;
        pharmacy_item_id?: string | null;
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