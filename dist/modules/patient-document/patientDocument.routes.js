"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const patientDocument_controller_1 = require("./patientDocument.controller");
const router = (0, express_1.Router)();
// Soft/flexible auth middleware for document viewing & downloading
const flexAuth = (req, res, next) => {
    try {
        const headerToken = req.headers.authorization?.split(" ")[1];
        const cookieToken = req.cookies?.token;
        const queryToken = typeof req.query.token === "string" ? req.query.token : undefined;
        const token = headerToken || cookieToken || queryToken;
        if (token) {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
        }
    }
    catch {
        // If token invalid, proceed without user context
    }
    next();
};
// 1. Upload a document
router.post("/upload", flexAuth, patientDocument_controller_1.patientDocumentController.uploadDocument);
// 2. Fetch list of documents for a patient
router.get("/patient/:patientId", flexAuth, patientDocument_controller_1.patientDocumentController.getPatientDocuments);
// 3. View document (inline display / stream)
router.get("/:documentId/view", flexAuth, patientDocument_controller_1.patientDocumentController.viewDocument);
// 4. Download document (attachment stream)
router.get("/:documentId/download", flexAuth, patientDocument_controller_1.patientDocumentController.downloadDocument);
// 5. Delete document
router.delete("/:documentId", flexAuth, patientDocument_controller_1.patientDocumentController.deleteDocument);
exports.default = router;
