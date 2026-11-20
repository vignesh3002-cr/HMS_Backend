"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../auth/auth.middleware");
const authorize_1 = require("../../middleware/authorize");
const genomics_controller_1 = require("./genomics.controller");
const genomics_validation_1 = require("./genomics.validation");
const router = (0, express_1.Router)();
const READ = (0, authorize_1.authorize)("oncology.diagnosis.read");
const CREATE = (0, authorize_1.authorize)("oncology.diagnosis.create");
const UPDATE = (0, authorize_1.authorize)("oncology.diagnosis.update");
// ---------------- Lookups ----------------
router.get("/cancer-sites", auth_middleware_1.authenticate, READ, genomics_controller_1.genomicsController.getCancerSites);
router.get("/genes", auth_middleware_1.authenticate, READ, genomics_validation_1.getGenesValidation, genomics_controller_1.genomicsController.getGenes);
router.get("/labs", auth_middleware_1.authenticate, READ, genomics_controller_1.genomicsController.getLabs);
router.get("/key-alterations", auth_middleware_1.authenticate, READ, genomics_controller_1.genomicsController.getKeyAlterations);
// ---------------- Reports ----------------
router.get("/patients/:patientId/tests", auth_middleware_1.authenticate, READ, genomics_validation_1.listTestsValidation, genomics_controller_1.genomicsController.listTests);
router.post("/patients/:patientId/tests", auth_middleware_1.authenticate, CREATE, genomics_validation_1.createTestValidation, genomics_controller_1.genomicsController.createTest);
router.get("/tests/:testId", auth_middleware_1.authenticate, READ, genomics_validation_1.getTestValidation, genomics_controller_1.genomicsController.getTest);
router.put("/tests/:testId", auth_middleware_1.authenticate, UPDATE, genomics_validation_1.updateTestValidation, genomics_controller_1.genomicsController.updateTest);
router.delete("/tests/:testId", auth_middleware_1.authenticate, UPDATE, genomics_validation_1.deleteTestValidation, genomics_controller_1.genomicsController.deleteTest);
// ---------------- Gene master administration ----------------
router.get("/gene-master", auth_middleware_1.authenticate, READ, genomics_controller_1.genomicsController.listGeneMaster);
router.post("/gene-master", auth_middleware_1.authenticate, UPDATE, genomics_validation_1.createGeneValidation, genomics_controller_1.genomicsController.createGene);
router.put("/gene-master/:geneMasterId", auth_middleware_1.authenticate, UPDATE, genomics_validation_1.updateGeneValidation, genomics_controller_1.genomicsController.updateGene);
router.delete("/gene-master/:geneMasterId", auth_middleware_1.authenticate, UPDATE, genomics_controller_1.genomicsController.deleteGene);
exports.default = router;
