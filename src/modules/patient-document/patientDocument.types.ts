export interface UploadPatientDocumentDTO {
  patient_id: string;
  file_name: string;
  original_name?: string;
  file_type: string;
  file_size: number;
  file_data: string; // Base64 string
  category?: string;
  uploaded_by?: string;
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
}

export interface PatientDocumentFull extends PatientDocumentMeta {
  file_data: string;
}

