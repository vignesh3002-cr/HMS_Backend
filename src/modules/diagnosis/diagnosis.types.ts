export interface DiagnosisCategory {
    diagnosis_catogory_id: string;
    diagnosis_category: string;
    count: number;
}

export interface DiagnosisItem {
    diagnosis_id: string;
    diagnosis_name: string;
    icd_code: string | null;
    diagnosis_description: string | null;
}

export interface GetDiagnosisCategoriesQuery {
    search?: string;
    activeOnly?: boolean;
    page?: number;
    limit?: number;
}

export interface GetDiagnosesByCategoryQuery {
    categoryId: string;
    search?: string;
    activeOnly?: boolean;
    page?: number;
    limit?: number;
}