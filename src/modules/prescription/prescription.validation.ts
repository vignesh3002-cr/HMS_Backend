import { body, param, query } from "express-validator";
import { PRESCRIPTION_STATUS_VALUES, BEFORE_AFTER_FOOD_VALUES } from "./prescription.constants";

const medicineItemValidation = (prefix: string) => {

    const field = (name: string) => (prefix ? `${prefix}.${name}` : name);

    return [
        body(field("medicine_id")).notEmpty().withMessage("Medicine is required"),
        body(field("dosage")).optional().isString(),
        body(field("unit")).optional().isString(),
        body(field("route")).optional().isString(),
        body(field("frequency")).optional().isString(),
        body(field("before_after_food")).optional().isIn(BEFORE_AFTER_FOOD_VALUES),
        body(field("morning")).optional().isBoolean(),
        body(field("afternoon")).optional().isBoolean(),
        body(field("night")).optional().isBoolean(),
        body(field("days")).optional().isInt({ min: 1 }),
        body(field("duration")).optional().isString(),
        body(field("quantity")).optional().isInt({ min: 1 }),
        body(field("instruction")).optional().isString()
    ];

};

export const createPrescriptionValidation = [

    body("encounter_no").notEmpty().withMessage("Encounter is required"),
    body("diagnosis_id").optional().notEmpty(),
    body("visit_type").optional().isString(),
    body("chief_complaint").optional().isString(),
    body("clinical_notes").optional().isString(),
    body("advice").optional().isString(),
    body("followup_date")
        .optional()
        .isISO8601()
        .withMessage("Follow-up date must be a valid date (YYYY-MM-DD)"),
    body("medicines").isArray({ min: 1 }).withMessage("At least one medicine is required"),
    ...medicineItemValidation("medicines.*")

];

export const getPrescriptionsValidation = [

    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("status").optional().isIn(PRESCRIPTION_STATUS_VALUES),
    query("date").optional().isISO8601(),
    query("dateFrom").optional().isISO8601(),
    query("dateTo").optional().isISO8601()

];

export const getPrescriptionByIdValidation = [
    param("prescriptionId").notEmpty()
];

export const updatePrescriptionValidation = [

    param("prescriptionId").notEmpty(),
    body("diagnosis_id").optional().notEmpty(),
    body("chief_complaint").optional().isString(),
    body("clinical_notes").optional().isString(),
    body("advice").optional().isString(),
    body("followup_date")
        .optional()
        .isISO8601()
        .withMessage("Follow-up date must be a valid date (YYYY-MM-DD)"),
    body("status").optional().isIn(PRESCRIPTION_STATUS_VALUES)

];

export const deletePrescriptionValidation = [
    param("prescriptionId").notEmpty()
];

export const getPrescriptionItemsValidation = [
    param("prescriptionId").notEmpty()
];

export const addPrescriptionItemValidation = [
    param("prescriptionId").notEmpty(),
    ...medicineItemValidation("")
];

export const updatePrescriptionItemValidation = [

    param("prescriptionId").notEmpty(),
    param("itemId").notEmpty(),
    body("medicine_id").optional().notEmpty(),
    body("dosage").optional().isString(),
    body("unit").optional().isString(),
    body("route").optional().isString(),
    body("frequency").optional().isString(),
    body("before_after_food").optional().isIn(BEFORE_AFTER_FOOD_VALUES),
    body("morning").optional().isBoolean(),
    body("afternoon").optional().isBoolean(),
    body("night").optional().isBoolean(),
    body("days").optional().isInt({ min: 1 }),
    body("duration").optional().isString(),
    body("quantity").optional().isInt({ min: 1 }),
    body("instruction").optional().isString()

];

export const deletePrescriptionItemValidation = [
    param("prescriptionId").notEmpty(),
    param("itemId").notEmpty()
];

export const getSuggestedMedicinesValidation = [
    param("diagnosisId").notEmpty()
];
