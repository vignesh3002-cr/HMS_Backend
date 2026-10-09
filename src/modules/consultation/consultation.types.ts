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

export interface EncounterReportDTO {

    // One of the two: a lab_test_master test, or a test typed by hand.
    lab_test_id?: string | null;
    test_name?: string | null;
    report_completed_date?: string | null; // YYYY-MM-DD
    result?: string | null;
    impression?: string | null;

}
