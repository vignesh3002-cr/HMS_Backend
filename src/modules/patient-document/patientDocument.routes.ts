import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { patientDocumentController } from "./patientDocument.controller";

const router = Router();

// Soft/flexible auth middleware for document viewing & downloading
const flexAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const headerToken = req.headers.authorization?.split(" ")[1];
    const cookieToken = req.cookies?.token;
    const queryToken = typeof req.query.token === "string" ? req.query.token : undefined;
    const token = headerToken || cookieToken || queryToken;

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!);
      (req as any).user = decoded;
    }
  } catch {
    // If token invalid, proceed without user context
  }
  next();
};

// 1. Upload a document
router.post("/upload", flexAuth, patientDocumentController.uploadDocument);

// 2. Fetch list of documents for a patient
router.get("/patient/:patientId", flexAuth, patientDocumentController.getPatientDocuments);

// 3. View document (inline display / stream)
router.get("/:documentId/view", flexAuth, patientDocumentController.viewDocument);

// 4. Download document (attachment stream)
router.get("/:documentId/download", flexAuth, patientDocumentController.downloadDocument);

// 5. Delete document
router.delete("/:documentId", flexAuth, patientDocumentController.deleteDocument);

export default router;

