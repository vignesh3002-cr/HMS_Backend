export interface CreateLabReportDto {
  lab_order_id: string;
  report_number?: string;
  generated_datetime?: Date | string;
  approved_by?: string;
  approved_datetime?: Date | string;
  report_status?: string;
  report_file?: string;
  digital_signature?: string;
  /* The report's comment: an object ({ text, parameters, ... }), its JSON
     string, or plain text. */
  report_comment?: string | Record<string, unknown>;
  delivered_to?: string;
  delivered_datetime?: Date | string;
  branch_id?: string;
  user_id?: string;
  parameters?: any[];
  clinical_correlation?: string;
  overall_decision?: string;
  lab_order_item_id?: string;
}

export interface UpdateLabReportDto {
  report_number?: string;
  generated_datetime?: Date | string;
  approved_by?: string;
  approved_datetime?: Date | string;
  report_status?: string;
  report_file?: string;
  digital_signature?: string;
  /* The report's comment: an object ({ text, parameters, ... }), its JSON
     string, or plain text. */
  report_comment?: string | Record<string, unknown>;
  delivered_to?: string;
  delivered_datetime?: Date | string;
  branch_id?: string;
  user_id?: string;
  parameters?: any[];
  clinical_correlation?: string;
  overall_decision?: string;
}

export interface TransferLabReportDto {
  delivered_to: string;
  delivered_datetime?: Date | string;
  channel?: string;
  remarks?: string;
  report_status?: string;
}
