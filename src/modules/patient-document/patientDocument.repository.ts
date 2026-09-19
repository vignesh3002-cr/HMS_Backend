import prisma from "../../config/prisma";
import { UploadPatientDocumentDTO, PatientDocumentMeta, PatientDocumentFull } from "./patientDocument.types";

export class PatientDocumentRepository {
  async createDocument(data: {
    document_id: string;
    patient_id: string;
    file_name: string;
    original_name: string;
    file_type: string;
    file_size: number;
    file_data: string;
    category?: string;
    uploaded_by?: string;
  }): Promise<PatientDocumentMeta> {
    const record = await (prisma as any).patient_document.create({
      data: {
        document_id: data.document_id,
        patient_id: data.patient_id,
        file_name: data.file_name,
        original_name: data.original_name,
        file_type: data.file_type,
        file_size: BigInt(data.file_size),
        file_data: data.file_data,
        category: data.category || "Clinical",
        uploaded_by: data.uploaded_by || null,
      },
      select: {
        id: true,
        document_id: true,
        patient_id: true,
        file_name: true,
        original_name: true,
        file_type: true,
        file_size: true,
        category: true,
        uploaded_by: true,
        created_at: true,
        updated_at: true,
      },
    });

    return {
      id: record.document_id,
      document_id: record.document_id,
      patient_id: record.patient_id,
      file_name: record.file_name,
      original_name: record.original_name,
      file_type: record.file_type,
      file_size: Number(record.file_size),
      category: record.category,
      uploaded_by: record.uploaded_by,
      created_at: record.created_at,
      updated_at: record.updated_at,
    };
  }

  async findByPatientId(patientId: string): Promise<PatientDocumentMeta[]> {
    const records = await (prisma as any).patient_document.findMany({
      where: { patient_id: patientId },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        document_id: true,
        patient_id: true,
        file_name: true,
        original_name: true,
        file_type: true,
        file_size: true,
        category: true,
        uploaded_by: true,
        created_at: true,
        updated_at: true,
      },
    });

    return records.map((r: any) => ({
      id: r.document_id,
      document_id: r.document_id,
      patient_id: r.patient_id,
      file_name: r.file_name,
      original_name: r.original_name,
      file_type: r.file_type,
      file_size: Number(r.file_size),
      category: r.category,
      uploaded_by: r.uploaded_by,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  }

  async findByDocumentId(documentId: string): Promise<PatientDocumentFull | null> {
    const record = await (prisma as any).patient_document.findUnique({
      where: { document_id: documentId },
    });

    if (!record) return null;

    return {
      id: record.document_id,
      document_id: record.document_id,
      patient_id: record.patient_id,
      file_name: record.file_name,
      original_name: record.original_name,
      file_type: record.file_type,
      file_size: Number(record.file_size),
      file_data: record.file_data,
      category: record.category,
      uploaded_by: record.uploaded_by,
      created_at: record.created_at,
      updated_at: record.updated_at,
    };
  }

  async deleteByDocumentId(documentId: string): Promise<boolean> {
    const deleted = await (prisma as any).patient_document.deleteMany({
      where: { document_id: documentId },
    });
    return deleted.count > 0;
  }
}

export const patientDocumentRepository = new PatientDocumentRepository();

