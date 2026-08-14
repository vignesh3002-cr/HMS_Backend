"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const diagnosis_controller_1 = require("./diagnosis.controller");
const auth_middleware_1 = require("../auth/auth.middleware");
const authorize_1 = require("../../middleware/authorize");
const branchScope_1 = require("../../middleware/branchScope");
const diagnosis_validation_1 = require("./diagnosis.validation");
const router = (0, express_1.Router)();
const controller = new diagnosis_controller_1.DiagnosisController();
// Get all diagnosis categories (with counts)
router.get("/categories", auth_middleware_1.authenticate, (0, authorize_1.authorize)("diagnosis.read"), branchScope_1.branchScope, diagnosis_validation_1.getDiagnosisCategoriesValidation, controller.getDiagnosisCategories.bind(controller));
// Get diagnoses by category ID
router.get("/categories/:categoryId/diagnoses", auth_middleware_1.authenticate, (0, authorize_1.authorize)("diagnosis.read"), branchScope_1.branchScope, diagnosis_validation_1.getDiagnosesByCategoryValidation, controller.getDiagnosesByCategory.bind(controller));
// Get single diagnosis by ID
router.get("/:diagnosisId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("diagnosis.read"), diagnosis_validation_1.getDiagnosisByIdValidation, controller.getDiagnosisById.bind(controller));
exports.default = router;
