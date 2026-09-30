"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const consultation_controller_1 = require("./consultation.controller");
const auth_middleware_1 = require("../auth/auth.middleware");
const authorize_1 = require("../../middleware/authorize");
const consultation_validation_1 = require("./consultation.validation");
const router = (0, express_1.Router)();
const controller = new consultation_controller_1.ConsultationController();
// ---------------- Master data ----------------
router.get("/masters/immunizations", auth_middleware_1.authenticate, (0, authorize_1.authorize)("encounter.read"), consultation_validation_1.listMasterValidation, controller.getImmunizations.bind(controller));
router.post("/masters/immunizations/custom", auth_middleware_1.authenticate, (0, authorize_1.authorize)("encounter.update"), consultation_validation_1.createCustomMasterValidation, controller.createCustomImmunization.bind(controller));
router.get("/masters/drug-consumptions", auth_middleware_1.authenticate, (0, authorize_1.authorize)("encounter.read"), consultation_validation_1.listMasterValidation, controller.getDrugConsumptions.bind(controller));
router.post("/masters/drug-consumptions/custom", auth_middleware_1.authenticate, (0, authorize_1.authorize)("encounter.update"), consultation_validation_1.createCustomMasterValidation, controller.createCustomDrugConsumption.bind(controller));
router.get("/masters/general-examination-findings", auth_middleware_1.authenticate, (0, authorize_1.authorize)("encounter.read"), consultation_validation_1.listMasterValidation, controller.getGeneralExaminationFindings.bind(controller));
router.post("/masters/general-examination-findings/custom", auth_middleware_1.authenticate, (0, authorize_1.authorize)("encounter.update"), consultation_validation_1.createCustomMasterValidation, controller.createCustomGeneralExaminationFinding.bind(controller));
router.get("/masters/treatment-types", auth_middleware_1.authenticate, (0, authorize_1.authorize)("encounter.read"), consultation_validation_1.listMasterValidation, controller.getTreatmentTypes.bind(controller));
router.post("/masters/treatment-types/custom", auth_middleware_1.authenticate, (0, authorize_1.authorize)("encounter.update"), consultation_validation_1.createCustomMasterValidation, controller.createCustomTreatmentType.bind(controller));
router.get("/masters/molecular-tests", auth_middleware_1.authenticate, (0, authorize_1.authorize)("encounter.read"), controller.getMolecularTestOptions.bind(controller));
router.get("/masters/diet-types", auth_middleware_1.authenticate, (0, authorize_1.authorize)("encounter.read"), controller.getDietTypes.bind(controller));
// ---------------- Personal history ----------------
router.get("/encounters/:encounterNo/personal-history", auth_middleware_1.authenticate, (0, authorize_1.authorize)("encounter.read"), consultation_validation_1.getPersonalHistoryValidation, controller.getPersonalHistory.bind(controller));
router.put("/encounters/:encounterNo/personal-history", auth_middleware_1.authenticate, (0, authorize_1.authorize)("encounter.update"), consultation_validation_1.upsertPersonalHistoryValidation, controller.upsertPersonalHistory.bind(controller));
// ---------------- Encounter reports ----------------
router.get("/encounters/:encounterNo/reports", auth_middleware_1.authenticate, (0, authorize_1.authorize)("encounter.read"), consultation_validation_1.getPersonalHistoryValidation, controller.getReports.bind(controller));
router.post("/encounters/:encounterNo/reports", auth_middleware_1.authenticate, (0, authorize_1.authorize)("encounter.update"), consultation_validation_1.addReportValidation, controller.addReport.bind(controller));
router.put("/reports/:encounterReportId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("encounter.update"), consultation_validation_1.updateReportValidation, controller.updateReport.bind(controller));
router.delete("/reports/:encounterReportId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("encounter.update"), consultation_validation_1.reportIdValidation, controller.removeReport.bind(controller));
// ---------------- Encounter molecular tests ----------------
router.get("/encounters/:encounterNo/molecular-tests", auth_middleware_1.authenticate, (0, authorize_1.authorize)("encounter.read"), consultation_validation_1.getPersonalHistoryValidation, controller.getMolecularTests.bind(controller));
router.post("/encounters/:encounterNo/molecular-tests", auth_middleware_1.authenticate, (0, authorize_1.authorize)("encounter.update"), consultation_validation_1.addMolecularTestValidation, controller.addMolecularTest.bind(controller));
router.put("/molecular-tests/:encounterMolecularTestId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("encounter.update"), consultation_validation_1.updateMolecularTestValidation, controller.updateMolecularTest.bind(controller));
router.delete("/molecular-tests/:encounterMolecularTestId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("encounter.update"), consultation_validation_1.molecularTestIdValidation, controller.removeMolecularTest.bind(controller));
exports.default = router;
