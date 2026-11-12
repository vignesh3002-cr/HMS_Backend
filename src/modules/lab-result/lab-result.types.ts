export interface CreateLabResultDto {
  sample_collection_id: string;
  lab_order_item_id: string;
  parameter_name: string;
  result_value?: string;
  abnormal_flag?: string;
  result_comment?: string;
  verified_by?: string;
  verified_datetime?: Date;
  result_status?: string;
  lab_test_parameter_id?: string;
  lab_report_id?: string;
  branch_id?: string;
  user_id?: string;
}

export interface UpdateLabResultDto {
  result_value?: string;
  abnormal_flag?: string;
  result_comment?: string;
  verified_by?: string;
  verified_datetime?: Date;
  result_status?: string;
  lab_report_id?: string;
}

export interface BatchSaveLabResultItemDto {
  lab_result_id?: string;
  lab_test_parameter_id?: string;
  parameter_name: string;
  result_value: string;
  abnormal_flag?: string;
  result_status?: string;
  result_comment?: string;
  unit?: string;
  reference_range?: string;
}

export interface BatchSaveLabResultsPayload {
  lab_order_item_id: string;
  sample_collection_id?: string;
  barcode?: string;
  sample_type?: string;
  parameters: BatchSaveLabResultItemDto[];
  comments?: string;
  markCompleted?: boolean;
  verified_by?: string;
  branch_id?: string;
  user_id?: string;
}
