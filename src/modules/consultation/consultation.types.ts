export interface MasterListQuery {

    search?: string;
    isActive?: boolean;

}

export interface CreateCustomMasterDTO {

    name: string;
    description?: string | null;

}

export interface PersonalHistoryPayload {

    immunization?: { code: string; name: string; others?: string }[] | null;
    drug_consumption?: { code: string; name: string; others?: string }[] | null;
    diet_type?: string | null;

}

export interface EncounterMolecularTestDTO {

    // One of MOLECULAR_TESTS, or a test typed by hand.
    test_name: string;
    test_date?: string | null; // YYYY-MM-DD
    result?: string | null;
    impression?: string | null;

}

export interface EncounterImmunizationDTO {

    // The selected value as shown in the form (master name or typed text).
    immunization_name: string;
    // immunization_master code when it is a master entry; null for "Others".
    immunization_code?: string | null;
    immunization_date?: string | null; // YYYY-MM-DD
    response?: string | null;

}

export interface EncounterImmunizationSyncDTO {

    // Full set of selected immunizations for the encounter; rows missing from
    // this list are removed on sync.
    rows: EncounterImmunizationDTO[];

}

export interface EncounterPastTreatmentDTO {

    // The selected Treatment Type as shown in the form (master name).
    treatment_type: string;
    // treatment_type_master code when it is a master entry.
    treatment_type_code?: string | null;
    treatment_date?: string | null; // YYYY-MM-DD
    note?: string | null;
    treatment_response?: string | null;

}

export interface EncounterPastTreatmentSyncDTO {

    // Full set of selected treatment types for the encounter; rows missing
    // from this list are removed on sync.
    rows: EncounterPastTreatmentDTO[];

}

export interface EncounterReportDTO {

    // One of the two: a lab_test_master test, or a test typed by hand.
    lab_test_id?: string | null;
    test_name?: string | null;
    report_completed_date?: string | null; // YYYY-MM-DD
    result?: string | null;
    impression?: string | null;

}
