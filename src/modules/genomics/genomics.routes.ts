import { Router } from "express";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../../middleware/authorize";
import { genomicsController } from "./genomics.controller";
import {
    createGeneValidation,
    createTestValidation,
    deleteTestValidation,
    getGenesValidation,
    getTestValidation,
    listTestsValidation,
    updateGeneValidation,
    updateTestValidation,
} from "./genomics.validation";

const router = Router();

const READ = authorize("oncology.diagnosis.read");
const CREATE = authorize("oncology.diagnosis.create");
const UPDATE = authorize("oncology.diagnosis.update");

// ---------------- Lookups ----------------
router.get("/cancer-sites", authenticate, READ, genomicsController.getCancerSites);
router.get("/genes", authenticate, READ, getGenesValidation, genomicsController.getGenes);
router.get("/labs", authenticate, READ, genomicsController.getLabs);
router.get("/key-alterations", authenticate, READ, genomicsController.getKeyAlterations);

// ---------------- Reports ----------------
router.get(
    "/patients/:patientId/tests",
    authenticate,
    READ,
    listTestsValidation,
    genomicsController.listTests
);
router.post(
    "/patients/:patientId/tests",
    authenticate,
    CREATE,
    createTestValidation,
    genomicsController.createTest
);
router.get("/tests/:testId", authenticate, READ, getTestValidation, genomicsController.getTest);
router.put(
    "/tests/:testId",
    authenticate,
    UPDATE,
    updateTestValidation,
    genomicsController.updateTest
);
router.delete(
    "/tests/:testId",
    authenticate,
    UPDATE,
    deleteTestValidation,
    genomicsController.deleteTest
);

// ---------------- Gene master administration ----------------
router.get("/gene-master", authenticate, READ, genomicsController.listGeneMaster);
router.post(
    "/gene-master",
    authenticate,
    UPDATE,
    createGeneValidation,
    genomicsController.createGene
);
router.put(
    "/gene-master/:geneMasterId",
    authenticate,
    UPDATE,
    updateGeneValidation,
    genomicsController.updateGene
);
router.delete(
    "/gene-master/:geneMasterId",
    authenticate,
    UPDATE,
    genomicsController.deleteGene
);

export default router;
