export interface MasterParameterInput {
    lab_test_parameter_id?: string;
    parameter_name: string;
    unit?: string | null;
    ref_range_low?: number | null;
    ref_range_high?: number | null;
    ref_range_text?: string | null;
    gender?: string | null;
    critical_low?: number | null;
    critical_high?: number | null;
    remarks?: string | null;
    value_type?: string | null;
    sort_order?: number | null;
    age_min?: number | null;
    age_max?: number | null;
}

export interface CreateLabTestMasterDto {
    lab_test_category_id?: string;
    category_name?: string;
    test_name: string;
    test_code: string;
    sample_type?: string;
    required_volume?: string;
    unit?: string;
    reference_range?: string;
    price?: number;
    tat_hours?: number;
    tat_text?: string;
    expiry_time_hours?: number;
    test_status?: number;
    is_panel?: boolean;
    includes_details?: string;
    is_outsourced?: boolean;
    outsource_lab?: string | null;
    result_type?: string | null;
    walkin_price?: number | null;
    parameters?: MasterParameterInput[];
}

export interface UpdateLabTestMasterDto {
    lab_test_category_id?: string;
    category_name?: string;
    test_name?: string;
    test_code?: string;
    sample_type?: string;
    required_volume?: string;
    unit?: string;
    reference_range?: string;
    price?: number;
    tat_hours?: number;
    tat_text?: string;
    expiry_time_hours?: number;
    test_status?: number;
    is_panel?: boolean;
    includes_details?: string;
    is_outsourced?: boolean;
    outsource_lab?: string | null;
    result_type?: string | null;
    walkin_price?: number | null;
    parameters?: MasterParameterInput[];
}
