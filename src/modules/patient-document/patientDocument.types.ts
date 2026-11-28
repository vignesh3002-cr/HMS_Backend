export interface UploadPatientDocumentDTO {
  patient_id: string;
  file_name: string;
  original_name?: string;
  file_type: string;
  file_size: number;
  file_data: string; // Base64 string
  category?: string;
  uploaded_by?: string;
  // The OPD visit or IPD stay this document belongs to -- the common column
  // across both modules. Optional so a document can still be uploaded
  // without one (kept patient-scoped only, as before).
  encounter_no?: string;
  // Free-text taxonomy (see patientDocument.constants.ts), validated at the
  // service layer.
  document_type?: string;
  // A planned chemotherapy course this document belongs to. Consent forms
  // use it so the same plan can find them on later visits, and a new plan
  // never inherits the previous course's consent.
  chemotherapy_plan_id?: string;
}

export interface PatientDocumentMeta {
  id: string; // document_id
  document_id: string;
  patient_id: string;
  file_name: string;
  original_name: string;
  file_type: string;
  file_size: number;
  category: string | null;
  uploaded_by: string | null;
  created_at: Date | null;
  updated_at: Date | null;
  encounter_no: string | null;
  document_type: string | null;
  chemotherapy_plan_id: string | null;
}

export interface PatientDocumentFull extends PatientDocumentMeta {
  file_data: string;
}

export interface PatientDocumentFilter {
  document_type?: string;
  chemotherapy_plan_id?: string;
  /** Only documents not yet attached to any chemotherapy plan. */
  unassigned?: boolean;
}
