import { Router } from "express";
import { authenticate, authenticateAllowQueryToken } from "../auth/auth.middleware";
import { patientDocumentController } from "./patientDocument.controller";

const router = Router();

// 1. Upload a document
router.post("/upload", authenticate, patientDocumentController.uploadDocument);

// 2. Fetch list of documents for a patient
router.get("/patient/:patientId", authenticate, patientDocumentController.getPatientDocuments);

// 2b. Fetch documents attached to one OPD visit / IPD stay (encounter-scoped)
router.get("/encounter/:encounterNo", authenticate, patientDocumentController.getDocumentsByEncounter);

// 3. View document (inline display / stream) -- opened directly by the
// browser (<img>/<a>), so a query-token fallback is allowed; a missing or
// invalid token is still rejected, never silently let through.
router.get("/:documentId/view", authenticateAllowQueryToken, patientDocumentController.viewDocument);

// 4. Download document (attachment stream) -- same query-token allowance as view.
router.get("/:documentId/download", authenticateAllowQueryToken, patientDocumentController.downloadDocument);

// 5. Delete document
router.delete("/:documentId", authenticate, patientDocumentController.deleteDocument);

export default router;
