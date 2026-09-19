"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.patientDocumentController = exports.PatientDocumentController = void 0;
const patientDocument_service_1 = require("./patientDocument.service");
class PatientDocumentController {
    service;
    constructor(service = patientDocument_service_1.patientDocumentService) {
        this.service = service;
    }
    uploadDocument = async (req, res) => {
        try {
            const { patient_id, patientId, file_name, fileName, original_name, originalName, file_type, fileType, file_size, fileSize, file_data, fileData, category, uploaded_by, uploadedBy, } = req.body;
            const pid = patient_id || patientId;
            const fname = file_name || fileName;
            const oname = original_name || originalName || fname;
            const ftype = file_type || fileType || "application/octet-stream";
            const fsize = Number(file_size || fileSize || 0);
            const fdata = file_data || fileData;
            const cat = category || "Clinical";
            const upBy = uploaded_by || uploadedBy || req.user?.name || "Doctor";
            if (!pid) {
                return res.status(400).json({ success: false, message: "patient_id is required" });
            }
            if (!fname) {
                return res.status(400).json({ success: false, message: "file_name is required" });
            }
            if (!fdata) {
                return res.status(400).json({ success: false, message: "file_data is required" });
            }
            const created = await this.service.uploadDocument({
                patient_id: pid,
                file_name: fname,
                original_name: oname,
                file_type: ftype,
                file_size: fsize,
                file_data: fdata,
                category: cat,
                uploaded_by: upBy,
            });
            return res.status(201).json({
                success: true,
                message: "Document uploaded successfully",
                data: created,
            });
        }
        catch (err) {
            console.error("Error uploading patient document:", err);
            return res.status(500).json({
                success: false,
                message: err.message || "Failed to upload document",
            });
        }
    };
    getPatientDocuments = async (req, res) => {
        try {
            const patientId = String(req.params.patientId || "");
            if (!patientId) {
                return res.status(400).json({ success: false, message: "patientId is required" });
            }
            const docs = await this.service.getDocumentsByPatient(patientId);
            return res.status(200).json({
                success: true,
                data: docs,
            });
        }
        catch (err) {
            console.error("Error fetching patient documents:", err);
            return res.status(500).json({
                success: false,
                message: err.message || "Failed to fetch patient documents",
            });
        }
    };
    viewDocument = async (req, res) => {
        try {
            const documentId = String(req.params.documentId || "");
            if (!documentId) {
                return res.status(400).json({ success: false, message: "documentId is required" });
            }
            const doc = await this.service.getDocumentById(documentId);
            if (!doc) {
                return res.status(404).json({ success: false, message: "Document not found" });
            }
            const fileBuffer = Buffer.from(doc.file_data, "base64");
            const safeFilename = encodeURIComponent(doc.original_name || doc.file_name);
            res.setHeader("Content-Type", doc.file_type || "application/octet-stream");
            res.setHeader("Content-Length", fileBuffer.length);
            res.setHeader("Content-Disposition", `inline; filename="${safeFilename}"`);
            return res.end(fileBuffer);
        }
        catch (err) {
            console.error("Error viewing document:", err);
            return res.status(500).json({
                success: false,
                message: err.message || "Failed to view document",
            });
        }
    };
    downloadDocument = async (req, res) => {
        try {
            const documentId = String(req.params.documentId || "");
            if (!documentId) {
                return res.status(400).json({ success: false, message: "documentId is required" });
            }
            const doc = await this.service.getDocumentById(documentId);
            if (!doc) {
                return res.status(404).json({ success: false, message: "Document not found" });
            }
            const fileBuffer = Buffer.from(doc.file_data, "base64");
            const safeFilename = encodeURIComponent(doc.original_name || doc.file_name);
            res.setHeader("Content-Type", doc.file_type || "application/octet-stream");
            res.setHeader("Content-Length", fileBuffer.length);
            res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
            return res.end(fileBuffer);
        }
        catch (err) {
            console.error("Error downloading document:", err);
            return res.status(500).json({
                success: false,
                message: err.message || "Failed to download document",
            });
        }
    };
    deleteDocument = async (req, res) => {
        try {
            const documentId = String(req.params.documentId || "");
            if (!documentId) {
                return res.status(400).json({ success: false, message: "documentId is required" });
            }
            const success = await this.service.deleteDocument(documentId);
            if (!success) {
                return res.status(404).json({ success: false, message: "Document not found or already deleted" });
            }
            return res.status(200).json({
                success: true,
                message: "Document deleted successfully",
            });
        }
        catch (err) {
            console.error("Error deleting document:", err);
            return res.status(500).json({
                success: false,
                message: err.message || "Failed to delete document",
            });
        }
    };
}
exports.PatientDocumentController = PatientDocumentController;
exports.patientDocumentController = new PatientDocumentController();
