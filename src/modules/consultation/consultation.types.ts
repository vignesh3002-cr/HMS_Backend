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

export interface EncounterReportDTO {

    // One of the two: a lab_test_master test, or a test typed by hand.
    lab_test_id?: string | null;
    test_name?: string | null;
    report_completed_date?: string | null; // YYYY-MM-DD
    result?: string | null;
    impression?: string | null;

}
