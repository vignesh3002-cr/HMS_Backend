"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const oncology_controller_1 = require("./oncology.controller");
const auth_middleware_1 = require("../auth/auth.middleware");
const authorize_1 = require("../../middleware/authorize");
const branchScope_1 = require("../../middleware/branchScope");
const oncology_validation_1 = require("./oncology.validation");
const router = (0, express_1.Router)();
const controller = new oncology_controller_1.OncologyController();
// ---------------- Reference lookups ----------------
router.get("/reference/cancer-types", auth_middleware_1.authenticate, (0, authorize_1.authorize)("oncology.reference.read"), controller.getCancerTypes.bind(controller));
router.get("/reference/cancer-types/:cancerTypeId/subtypes", auth_middleware_1.authenticate, (0, authorize_1.authorize)("oncology.reference.read"), oncology_validation_1.getCancerSubtypesValidation, controller.getCancerSubtypes.bind(controller));
router.get("/reference/staging", auth_middleware_1.authenticate, (0, authorize_1.authorize)("oncology.reference.read"), oncology_validation_1.getStagingReferenceValidation, controller.getStagingReference.bind(controller));
router.get("/reference/biomarker-tests", auth_middleware_1.authenticate, (0, authorize_1.authorize)("oncology.reference.read"), controller.getBiomarkerTests.bind(controller));
router.get("/reference/molecular-subtypes", auth_middleware_1.authenticate, (0, authorize_1.authorize)("oncology.reference.read"), controller.getMolecularSubtypes.bind(controller));
router.post("/reference/reseed", auth_middleware_1.authenticate, (0, authorize_1.authorize)("oncology.reference.manage"), controller.reseedReference.bind(controller));
// ---------------- Staging detail workflow ----------------
router.post("/staging-details", auth_middleware_1.authenticate, (0, authorize_1.authorize)("oncology.diagnosis.create"), oncology_validation_1.createStagingDetailValidation, controller.createStagingDetail.bind(controller));
router.get("/staging-details", auth_middleware_1.authenticate, (0, authorize_1.authorize)("oncology.diagnosis.read"), branchScope_1.branchScope, oncology_validation_1.listStagingDetailsValidation, controller.listStagingDetails.bind(controller));
router.get("/staging-details/:stagingDetailId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("oncology.diagnosis.read"), oncology_validation_1.getStagingDetailValidation, controller.getStagingDetail.bind(controller));
router.put("/staging-details/:stagingDetailId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("oncology.diagnosis.update"), oncology_validation_1.updateStagingDetailValidation, controller.updateStagingDetail.bind(controller));
router.put("/staging-details/:stagingDetailId/ihc", auth_middleware_1.authenticate, (0, authorize_1.authorize)("oncology.ihc.write"), oncology_validation_1.upsertIhcValidation, controller.upsertIhc.bind(controller));
router.put("/staging-details/:stagingDetailId/molecular", auth_middleware_1.authenticate, (0, authorize_1.authorize)("oncology.molecular.write"), oncology_validation_1.upsertMolecularValidation, controller.upsertMolecular.bind(controller));
router.get("/staging-details/:stagingDetailId/derived", auth_middleware_1.authenticate, (0, authorize_1.authorize)("oncology.derived.read"), oncology_validation_1.getStagingDetailValidation, controller.getDerivedFields.bind(controller));
exports.default = router;
