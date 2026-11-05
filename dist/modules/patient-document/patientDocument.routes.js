"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../auth/auth.middleware");
const patientDocument_controller_1 = require("./patientDocument.controller");
const router = (0, express_1.Router)();
// 1. Upload a document
router.post("/upload", auth_middleware_1.authenticate, patientDocument_controller_1.patientDocumentController.uploadDocument);
// 2. Fetch list of documents for a patient
router.get("/patient/:patientId", auth_middleware_1.authenticate, patientDocument_controller_1.patientDocumentController.getPatientDocuments);
// 2b. Fetch documents attached to one OPD visit / IPD stay (encounter-scoped)
router.get("/encounter/:encounterNo", auth_middleware_1.authenticate, patientDocument_controller_1.patientDocumentController.getDocumentsByEncounter);
// 3. View document (inline display / stream) -- opened directly by the
// browser (<img>/<a>), so a query-token fallback is allowed; a missing or
// invalid token is still rejected, never silently let through.
router.get("/:documentId/view", auth_middleware_1.authenticateAllowQueryToken, patientDocument_controller_1.patientDocumentController.viewDocument);
// 4. Download document (attachment stream) -- same query-token allowance as view.
router.get("/:documentId/download", auth_middleware_1.authenticateAllowQueryToken, patientDocument_controller_1.patientDocumentController.downloadDocument);
// 5. Delete document
router.delete("/:documentId", auth_middleware_1.authenticate, patientDocument_controller_1.patientDocumentController.deleteDocument);
exports.default = router;
