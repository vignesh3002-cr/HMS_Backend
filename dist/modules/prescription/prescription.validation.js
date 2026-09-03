"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrescriptionsByPatientIdValidation = exports.getPrescriptionsByPatientHistoryIdValidation = exports.getSuggestedMedicinesValidation = exports.deletePrescriptionItemValidation = exports.updatePrescriptionItemValidation = exports.addPrescriptionItemValidation = exports.getPrescriptionItemsValidation = exports.deletePrescriptionValidation = exports.updatePrescriptionValidation = exports.getPrescriptionByIdValidation = exports.getPrescriptionsValidation = exports.createPrescriptionValidation = void 0;
const express_validator_1 = require("express-validator");
const prescription_constants_1 = require("./prescription.constants");
const medicineItemValidation = (prefix) => {
    const field = (name) => (prefix ? `${prefix}.${name}` : name);
    return [
        (0, express_validator_1.body)(field("medicine_id")).notEmpty().withMessage("Medicine is required"),
        (0, express_validator_1.body)(field("dosage")).optional().isString(),
        (0, express_validator_1.body)(field("unit")).optional().isString(),
        (0, express_validator_1.body)(field("route")).optional().isString(),
        (0, express_validator_1.body)(field("frequency")).optional().isString(),
        (0, express_validator_1.body)(field("before_after_food")).optional().isIn(prescription_constants_1.BEFORE_AFTER_FOOD_VALUES),
        (0, express_validator_1.body)(field("morning")).optional().isBoolean(),
        (0, express_validator_1.body)(field("afternoon")).optional().isBoolean(),
        (0, express_validator_1.body)(field("night")).optional().isBoolean(),
        (0, express_validator_1.body)(field("days")).optional().isInt({ min: 1 }),
        (0, express_validator_1.body)(field("duration")).optional().isString(),
        (0, express_validator_1.body)(field("quantity")).optional().isInt({ min: 1 }),
        (0, express_validator_1.body)(field("instruction")).optional().isString()
    ];
};
exports.createPrescriptionValidation = [
    (0, express_validator_1.body)("encounter_no").notEmpty().withMessage("Encounter is required"),
    (0, express_validator_1.body)("diagnosis_id").optional().notEmpty(),
    (0, express_validator_1.body)("visit_type").optional().isString(),
    (0, express_validator_1.body)("chief_complaint").optional().isString(),
    (0, express_validator_1.body)("clinical_notes").optional().isString(),
    (0, express_validator_1.body)("advice").optional().isString(),
    (0, express_validator_1.body)("followup_date")
        .optional()
        .isISO8601()
        .withMessage("Follow-up date must be a valid date (YYYY-MM-DD)"),
    (0, express_validator_1.body)("medicines").isArray({ min: 1 }).withMessage("At least one medicine is required"),
    ...medicineItemValidation("medicines.*")
];
exports.getPrescriptionsValidation = [
    (0, express_validator_1.query)("page").optional().isInt({ min: 1 }),
    (0, express_validator_1.query)("limit").optional().isInt({ min: 1, max: 100 }),
    (0, express_validator_1.query)("status").optional().isIn(prescription_constants_1.PRESCRIPTION_STATUS_VALUES),
    (0, express_validator_1.query)("date").optional().isISO8601(),
    (0, express_validator_1.query)("dateFrom").optional().isISO8601(),
    (0, express_validator_1.query)("dateTo").optional().isISO8601()
];
exports.getPrescriptionByIdValidation = [
    (0, express_validator_1.param)("prescriptionId").notEmpty()
];
exports.updatePrescriptionValidation = [
    (0, express_validator_1.param)("prescriptionId").notEmpty(),
    (0, express_validator_1.body)("diagnosis_id").optional().notEmpty(),
    (0, express_validator_1.body)("chief_complaint").optional().isString(),
    (0, express_validator_1.body)("clinical_notes").optional().isString(),
    (0, express_validator_1.body)("advice").optional().isString(),
    (0, express_validator_1.body)("followup_date")
        .optional()
        .isISO8601()
        .withMessage("Follow-up date must be a valid date (YYYY-MM-DD)"),
    (0, express_validator_1.body)("status").optional().isIn(prescription_constants_1.PRESCRIPTION_STATUS_VALUES)
];
exports.deletePrescriptionValidation = [
    (0, express_validator_1.param)("prescriptionId").notEmpty()
];
exports.getPrescriptionItemsValidation = [
    (0, express_validator_1.param)("prescriptionId").notEmpty()
];
exports.addPrescriptionItemValidation = [
    (0, express_validator_1.param)("prescriptionId").notEmpty(),
    ...medicineItemValidation("")
];
exports.updatePrescriptionItemValidation = [
    (0, express_validator_1.param)("prescriptionId").notEmpty(),
    (0, express_validator_1.param)("itemId").notEmpty(),
    (0, express_validator_1.body)("medicine_id").optional().notEmpty(),
    (0, express_validator_1.body)("dosage").optional().isString(),
    (0, express_validator_1.body)("unit").optional().isString(),
    (0, express_validator_1.body)("route").optional().isString(),
    (0, express_validator_1.body)("frequency").optional().isString(),
    (0, express_validator_1.body)("before_after_food").optional().isIn(prescription_constants_1.BEFORE_AFTER_FOOD_VALUES),
    (0, express_validator_1.body)("morning").optional().isBoolean(),
    (0, express_validator_1.body)("afternoon").optional().isBoolean(),
    (0, express_validator_1.body)("night").optional().isBoolean(),
    (0, express_validator_1.body)("days").optional().isInt({ min: 1 }),
    (0, express_validator_1.body)("duration").optional().isString(),
    (0, express_validator_1.body)("quantity").optional().isInt({ min: 1 }),
    (0, express_validator_1.body)("instruction").optional().isString()
];
exports.deletePrescriptionItemValidation = [
    (0, express_validator_1.param)("prescriptionId").notEmpty(),
    (0, express_validator_1.param)("itemId").notEmpty()
];
exports.getSuggestedMedicinesValidation = [
    (0, express_validator_1.param)("diagnosisId").notEmpty()
];
exports.getPrescriptionsByPatientHistoryIdValidation = [
    (0, express_validator_1.param)("patientHistoryId").notEmpty()
];
exports.getPrescriptionsByPatientIdValidation = [
    (0, express_validator_1.param)("patientId").notEmpty(),
    (0, express_validator_1.query)("page").optional().isInt({ min: 1 }),
    (0, express_validator_1.query)("limit").optional().isInt({ min: 1, max: 100 }),
    (0, express_validator_1.query)("status").optional().isIn(prescription_constants_1.PRESCRIPTION_STATUS_VALUES),
    (0, express_validator_1.query)("dateFrom").optional().isISO8601(),
    (0, express_validator_1.query)("dateTo").optional().isISO8601(),
    (0, express_validator_1.query)("sortBy").optional().isIn(["created_at", "status", "prescription_date"]),
    (0, express_validator_1.query)("sortOrder").optional().isIn(["asc", "desc"])
];
