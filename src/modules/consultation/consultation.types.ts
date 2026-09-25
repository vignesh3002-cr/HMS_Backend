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

export interface EncounterReportDTO {

    lab_test_id: string;
    report_completed_date?: string | null; // YYYY-MM-DD
    result?: string | null;
    impression?: string | null;

}
