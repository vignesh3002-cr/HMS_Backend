import { patientDocumentRepository, PatientDocumentRepository } from "./patientDocument.repository";
import { UploadPatientDocumentDTO, PatientDocumentMeta, PatientDocumentFull } from "./patientDocument.types";

export class PatientDocumentService {
  constructor(private repo: PatientDocumentRepository = patientDocumentRepository) {}

  async uploadDocument(dto: UploadPatientDocumentDTO): Promise<PatientDocumentMeta> {
    if (!dto.patient_id) {
      throw new Error("patient_id is required");
    }
    if (!dto.file_name) {
      throw new Error("file_name is required");
    }
    if (!dto.file_data) {
      throw new Error("file_data is required");
    }

    // Strip base64 data prefix if present (e.g. data:image/png;base64,....)
    let rawBase64 = dto.file_data;
    if (rawBase64.includes(";base64,")) {
      rawBase64 = rawBase64.split(";base64,")[1];
    }

    const documentId = `DOC-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    const originalName = dto.original_name || dto.file_name;
    const fileType = dto.file_type || "application/octet-stream";
    const fileSize = dto.file_size || Math.round((rawBase64.length * 3) / 4);

    return this.repo.createDocument({
      document_id: documentId,
      patient_id: dto.patient_id,
      file_name: dto.file_name,
      original_name: originalName,
      file_type: fileType,
      file_size: fileSize,
      file_data: rawBase64,
      category: dto.category || "Clinical",
      uploaded_by: dto.uploaded_by || "Doctor",
    });
  }

  async getDocumentsByPatient(patientId: string): Promise<PatientDocumentMeta[]> {
    if (!patientId) return [];
    return this.repo.findByPatientId(patientId);
  }

  async getDocumentById(documentId: string): Promise<PatientDocumentFull | null> {
    if (!documentId) return null;
    return this.repo.findByDocumentId(documentId);
  }

  async deleteDocument(documentId: string): Promise<boolean> {
    if (!documentId) return false;
    return this.repo.deleteByDocumentId(documentId);
  }
}

export const patientDocumentService = new PatientDocumentService();

