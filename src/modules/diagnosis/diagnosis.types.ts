export interface CreateDiagnosisDto {

    patient_id: string;

    branch_id?: string;

    department_id?: string;

    diagnosing_doctor_id?: string;

    cancer_type_id?: string;

    cancer_stage_id?: string;

    tnm_stage_id?: string;

    histomorphology_id?: string;

    histological_grade_id?: string;

    icd_code_id?: string;

    primary_site?: string;

    laterality?: string;

    diagnosis_date?: string;

    diagnosis_basis?: string;

    clinical_notes?: string;

}

export interface UpdateDiagnosisDto {

    branch_id?: string;

    department_id?: string;

    diagnosing_doctor_id?: string;

    cancer_type_id?: string;

    cancer_stage_id?: string;

    tnm_stage_id?: string;

    histomorphology_id?: string;

    histological_grade_id?: string;

    icd_code_id?: string;

    primary_site?: string;

    laterality?: string;

    diagnosis_date?: string;

    diagnosis_basis?: string;

    clinical_notes?: string;

    diagnosis_status?: string;

    is_active?: boolean;

}

export interface GetDiagnosesQuery {

    patientId?: string;

    branchId?: string;

    departmentId?: string;

    doctorId?: string;

    cancerTypeId?: string;

    diagnosisStatus?: string;

    isActive?: string;

    search?: string;

    page?: number;

    limit?: number;

    sortBy?: string;

    sortOrder?: "asc" | "desc";

}
