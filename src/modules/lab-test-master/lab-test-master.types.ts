export interface CreateLabTestMasterDto {
    lab_test_category_id: string;
    test_name: string;
    test_code: string;
    sample_type?: string;
    required_volume?: string;
    unit?: string;
    reference_range?: string;
    price?: number;
    tat_hours?: number;
}

export interface UpdateLabTestMasterDto {
    lab_test_category_id?: string;
    test_name?: string;
    test_code?: string;
    sample_type?: string;
    required_volume?: string;
    unit?: string;
    reference_range?: string;
    price?: number;
    tat_hours?: number;
    test_status?: number;
}