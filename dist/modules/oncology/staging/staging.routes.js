"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../auth/auth.middleware");
const authorize_1 = require("../../../middleware/authorize");
const staging_controller_1 = require("./staging.controller");
const staging_validation_1 = require("./staging.validation");
// TNM staging module. Mounted at /api/oncology/staging.
const router = (0, express_1.Router)();
const controller = new staging_controller_1.StagingController();
// Recording a stage is part of the Diagnosis step, so either of its
// permissions will do.
const writeAccess = (0, authorize_1.authorizeAny)("oncology.diagnosis.create", "oncology.diagnosis.update");
router.get("/cancer-types/:cancerTypeId/schemas", auth_middleware_1.authenticate, (0, authorize_1.authorize)("oncology.diagnosis.read"), staging_validation_1.listStagingSchemasValidation, controller.listSchemas.bind(controller));
router.get("/schemas/:schemaId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("oncology.diagnosis.read"), staging_validation_1.getStagingSchemaValidation, controller.getSchema.bind(controller));
// Live preview and the authoritative derivation behind Save.
router.post("/derive", auth_middleware_1.authenticate, (0, authorize_1.authorize)("oncology.diagnosis.read"), staging_validation_1.deriveStageValidation, controller.derive.bind(controller));
router.get("/records", auth_middleware_1.authenticate, (0, authorize_1.authorize)("oncology.diagnosis.read"), staging_validation_1.listStageRecordsValidation, controller.listRecords.bind(controller));
router.put("/records", auth_middleware_1.authenticate, writeAccess, staging_validation_1.saveStageRecordsValidation, controller.saveRecords.bind(controller));
router.delete("/records/:stageRecordId", auth_middleware_1.authenticate, writeAccess, staging_validation_1.stageRecordIdValidation, controller.deleteRecord.bind(controller));
router.get("/history", auth_middleware_1.authenticate, (0, authorize_1.authorize)("oncology.diagnosis.read"), staging_validation_1.listStageHistoryValidation, controller.history.bind(controller));
exports.default = router;
