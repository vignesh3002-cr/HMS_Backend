"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDiagnosisValidation = exports.createDiagnosisValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createDiagnosisValidation = [
    (0, express_validator_1.body)("patient_id")
        .notEmpty()
        .withMessage("patient_id is required"),
    (0, express_validator_1.body)("branch_id")
        .optional()
        .isString(),
    (0, express_validator_1.body)("department_id")
        .optional()
        .isString(),
    (0, express_validator_1.body)("diagnosing_doctor_id")
        .optional()
        .isString(),
    (0, express_validator_1.body)("cancer_type_id")
        .optional()
        .isString(),
    (0, express_validator_1.body)("cancer_stage_id")
        .optional()
        .isString(),
    (0, express_validator_1.body)("tnm_stage_id")
        .optional()
        .isString(),
    (0, express_validator_1.body)("histomorphology_id")
        .optional()
        .isString(),
    (0, express_validator_1.body)("histological_grade_id")
        .optional()
        .isString(),
    (0, express_validator_1.body)("icd_code_id")
        .optional()
        .isString(),
    (0, express_validator_1.body)("primary_site")
        .optional()
        .isLength({ max: 200 }),
    (0, express_validator_1.body)("laterality")
        .optional()
        .isIn(["Left", "Right", "Bilateral", "Not Applicable"])
        .withMessage("laterality must be one of Left, Right, Bilateral, Not Applicable"),
    (0, express_validator_1.body)("diagnosis_date")
        .optional()
        .isISO8601()
        .withMessage("diagnosis_date must be a valid date"),
    (0, express_validator_1.body)("diagnosis_basis")
        .optional()
        .isIn(["Histopathology", "Cytology", "Radiology", "Clinical", "Other"])
        .withMessage("diagnosis_basis must be one of Histopathology, Cytology, Radiology, Clinical, Other"),
    (0, express_validator_1.body)("clinical_notes")
        .optional()
        .isString()
];
exports.updateDiagnosisValidation = [
    (0, express_validator_1.body)("diagnosis_date")
        .optional()
        .isISO8601()
        .withMessage("diagnosis_date must be a valid date"),
    (0, express_validator_1.body)("laterality")
        .optional()
        .isIn(["Left", "Right", "Bilateral", "Not Applicable"]),
    (0, express_validator_1.body)("diagnosis_basis")
        .optional()
        .isIn(["Histopathology", "Cytology", "Radiology", "Clinical", "Other"]),
    (0, express_validator_1.body)("diagnosis_status")
        .optional()
        .isIn(["Active", "Revised", "Resolved"])
        .withMessage("diagnosis_status must be one of Active, Revised, Resolved"),
    (0, express_validator_1.body)("is_active")
        .optional()
        .isBoolean()
        .withMessage("is_active must be a boolean")
];
