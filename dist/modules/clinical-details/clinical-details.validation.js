"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMasterListValidation = exports.getClinicalDetailsValidation = exports.updatePatientComorbidityValidation = exports.createPatientComorbidityValidation = exports.updatePatientAllergyValidation = exports.createPatientAllergyValidation = exports.updateEncounterSymptomValidation = exports.createEncounterSymptomValidation = exports.createEncounterPerformanceStatusValidation = exports.updateAllergyValidation = exports.createAllergyValidation = exports.updateSymptomValidation = exports.createSymptomValidation = exports.updatePerformanceStatusValidation = exports.createPerformanceStatusValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createPerformanceStatusValidation = [
    (0, express_validator_1.body)('code')
        .notEmpty()
        .withMessage('Code is required')
        .isLength({ max: 20 })
        .withMessage('Code must not exceed 20 characters')
        .matches(/^[A-Z0-9_]+$/)
        .withMessage('Code must be uppercase alphanumeric with underscores'),
    (0, express_validator_1.body)('description')
        .notEmpty()
        .withMessage('Description is required')
        .isLength({ max: 200 })
        .withMessage('Description must not exceed 200 characters'),
    (0, express_validator_1.body)('displayOrder')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Display order must be a non-negative integer'),
    (0, express_validator_1.body)('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean'),
    (0, express_validator_1.body)('createdBy')
        .optional()
        .isLength({ max: 20 })
        .withMessage('createdBy must not exceed 20 characters'),
];
exports.updatePerformanceStatusValidation = [
    (0, express_validator_1.param)('id')
        .notEmpty()
        .withMessage('Performance status ID is required')
        .isInt({ min: 1 })
        .withMessage('Invalid performance status ID'),
    (0, express_validator_1.body)('description')
        .optional()
        .isLength({ max: 200 })
        .withMessage('Description must not exceed 200 characters'),
    (0, express_validator_1.body)('displayOrder')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Display order must be a non-negative integer'),
    (0, express_validator_1.body)('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean'),
    (0, express_validator_1.body)('updatedBy')
        .optional()
        .isLength({ max: 20 })
        .withMessage('updatedBy must not exceed 20 characters'),
];
exports.createSymptomValidation = [
    (0, express_validator_1.body)('code')
        .notEmpty()
        .withMessage('Code is required')
        .isLength({ max: 30 })
        .withMessage('Code must not exceed 30 characters')
        .matches(/^[A-Z0-9_]+$/)
        .withMessage('Code must be uppercase alphanumeric with underscores'),
    (0, express_validator_1.body)('name')
        .notEmpty()
        .withMessage('Name is required')
        .isLength({ max: 150 })
        .withMessage('Name must not exceed 150 characters'),
    (0, express_validator_1.body)('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Description must not exceed 500 characters'),
    (0, express_validator_1.body)('category')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Category must not exceed 100 characters'),
    (0, express_validator_1.body)('bodySystem')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Body system must not exceed 100 characters'),
    (0, express_validator_1.body)('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean'),
    (0, express_validator_1.body)('createdBy')
        .optional()
        .isLength({ max: 20 })
        .withMessage('createdBy must not exceed 20 characters'),
];
exports.updateSymptomValidation = [
    (0, express_validator_1.param)('id')
        .notEmpty()
        .withMessage('Symptom ID is required')
        .isInt({ min: 1 })
        .withMessage('Invalid symptom ID'),
    (0, express_validator_1.body)('name')
        .optional()
        .isLength({ max: 150 })
        .withMessage('Name must not exceed 150 characters'),
    (0, express_validator_1.body)('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Description must not exceed 500 characters'),
    (0, express_validator_1.body)('category')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Category must not exceed 100 characters'),
    (0, express_validator_1.body)('bodySystem')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Body system must not exceed 100 characters'),
    (0, express_validator_1.body)('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean'),
    (0, express_validator_1.body)('updatedBy')
        .optional()
        .isLength({ max: 20 })
        .withMessage('updatedBy must not exceed 20 characters'),
];
exports.createAllergyValidation = [
    (0, express_validator_1.body)('code')
        .notEmpty()
        .withMessage('Code is required')
        .isLength({ max: 30 })
        .withMessage('Code must not exceed 30 characters')
        .matches(/^[A-Z0-9_]+$/)
        .withMessage('Code must be uppercase alphanumeric with underscores'),
    (0, express_validator_1.body)('substanceName')
        .notEmpty()
        .withMessage('Substance name is required')
        .isLength({ max: 150 })
        .withMessage('Substance name must not exceed 150 characters'),
    (0, express_validator_1.body)('substanceType')
        .notEmpty()
        .withMessage('Substance type is required')
        .isLength({ max: 100 })
        .withMessage('Substance type must not exceed 100 characters'),
    (0, express_validator_1.body)('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Description must not exceed 500 characters'),
    (0, express_validator_1.body)('severityLevel')
        .optional()
        .isLength({ max: 30 })
        .withMessage('Severity level must not exceed 30 characters'),
    (0, express_validator_1.body)('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean'),
    (0, express_validator_1.body)('createdBy')
        .optional()
        .isLength({ max: 20 })
        .withMessage('createdBy must not exceed 20 characters'),
];
exports.updateAllergyValidation = [
    (0, express_validator_1.param)('id')
        .notEmpty()
        .withMessage('Allergy ID is required')
        .isInt({ min: 1 })
        .withMessage('Invalid allergy ID'),
    (0, express_validator_1.body)('substanceName')
        .optional()
        .isLength({ max: 150 })
        .withMessage('Substance name must not exceed 150 characters'),
    (0, express_validator_1.body)('substanceType')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Substance type must not exceed 100 characters'),
    (0, express_validator_1.body)('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Description must not exceed 500 characters'),
    (0, express_validator_1.body)('severityLevel')
        .optional()
        .isLength({ max: 30 })
        .withMessage('Severity level must not exceed 30 characters'),
    (0, express_validator_1.body)('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean'),
    (0, express_validator_1.body)('updatedBy')
        .optional()
        .isLength({ max: 20 })
        .withMessage('updatedBy must not exceed 20 characters'),
];
exports.createEncounterPerformanceStatusValidation = [
    (0, express_validator_1.param)('encounterNo')
        .notEmpty()
        .withMessage('Encounter number is required')
        .isLength({ max: 30 })
        .withMessage('Invalid encounter number'),
    (0, express_validator_1.body)('performanceStatusId')
        .notEmpty()
        .withMessage('Performance status ID is required')
        .isInt({ min: 1 })
        .withMessage('Invalid performance status ID'),
    (0, express_validator_1.body)('assessedBy')
        .optional()
        .isLength({ max: 20 })
        .withMessage('assessedBy must not exceed 20 characters'),
    (0, express_validator_1.body)('clinicalNotes')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Clinical notes must not exceed 1000 characters'),
];
exports.createEncounterSymptomValidation = [
    (0, express_validator_1.param)('encounterNo')
        .notEmpty()
        .withMessage('Encounter number is required')
        .isLength({ max: 30 })
        .withMessage('Invalid encounter number'),
    (0, express_validator_1.body)('symptomId')
        .notEmpty()
        .withMessage('Symptom ID is required')
        .isInt({ min: 1 })
        .withMessage('Invalid symptom ID'),
    (0, express_validator_1.body)('severity')
        .optional()
        .isIn(['MILD', 'MODERATE', 'SEVERE', 'CRITICAL'])
        .withMessage('Invalid severity value'),
    (0, express_validator_1.body)('durationDays')
        .optional()
        .isInt({ min: 0, max: 9999 })
        .withMessage('Duration days must be between 0 and 9999'),
    (0, express_validator_1.body)('onsetDate')
        .optional()
        .isISO8601()
        .withMessage('Onset date must be a valid date (YYYY-MM-DD)'),
    (0, express_validator_1.body)('clinicalNotes')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Clinical notes must not exceed 1000 characters'),
    (0, express_validator_1.body)('recordedBy')
        .optional()
        .isLength({ max: 20 })
        .withMessage('recordedBy must not exceed 20 characters'),
];
exports.updateEncounterSymptomValidation = [
    (0, express_validator_1.param)('encounterNo')
        .notEmpty()
        .withMessage('Encounter number is required')
        .isLength({ max: 30 })
        .withMessage('Invalid encounter number'),
    (0, express_validator_1.param)('symptomId')
        .notEmpty()
        .withMessage('Symptom ID is required')
        .isInt({ min: 1 })
        .withMessage('Invalid symptom ID'),
    (0, express_validator_1.body)('severity')
        .optional()
        .isIn(['MILD', 'MODERATE', 'SEVERE', 'CRITICAL'])
        .withMessage('Invalid severity value'),
    (0, express_validator_1.body)('durationDays')
        .optional()
        .isInt({ min: 0, max: 9999 })
        .withMessage('Duration days must be between 0 and 9999'),
    (0, express_validator_1.body)('onsetDate')
        .optional()
        .isISO8601()
        .withMessage('Onset date must be a valid date (YYYY-MM-DD)'),
    (0, express_validator_1.body)('clinicalNotes')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Clinical notes must not exceed 1000 characters'),
    (0, express_validator_1.body)('status')
        .optional()
        .isIn(['ACTIVE', 'RESOLVED', 'CHRONIC'])
        .withMessage('Invalid status value'),
    (0, express_validator_1.body)('updatedBy')
        .optional()
        .isLength({ max: 20 })
        .withMessage('updatedBy must not exceed 20 characters'),
];
exports.createPatientAllergyValidation = [
    (0, express_validator_1.param)('patientId')
        .notEmpty()
        .withMessage('Patient ID is required')
        .isLength({ max: 20 })
        .withMessage('Invalid patient ID'),
    (0, express_validator_1.body)('allergyId')
        .notEmpty()
        .withMessage('Allergy ID is required')
        .isInt({ min: 1 })
        .withMessage('Invalid allergy ID'),
    (0, express_validator_1.body)('reaction')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Reaction must not exceed 500 characters'),
    (0, express_validator_1.body)('severity')
        .optional()
        .isIn(['MILD', 'MODERATE', 'SEVERE', 'ANAPHYLACTIC'])
        .withMessage('Invalid severity value'),
    (0, express_validator_1.body)('status')
        .optional()
        .isIn(['ACTIVE', 'INACTIVE', 'RESOLVED'])
        .withMessage('Invalid status value'),
    (0, express_validator_1.body)('identifiedBy')
        .optional()
        .isLength({ max: 20 })
        .withMessage('identifiedBy must not exceed 20 characters'),
    (0, express_validator_1.body)('identifiedAtEncounterNo')
        .optional()
        .isLength({ max: 30 })
        .withMessage('Invalid encounter number'),
    (0, express_validator_1.body)('clinicalNotes')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Clinical notes must not exceed 1000 characters'),
];
exports.updatePatientAllergyValidation = [
    (0, express_validator_1.param)('patientId')
        .notEmpty()
        .withMessage('Patient ID is required')
        .isLength({ max: 20 })
        .withMessage('Invalid patient ID'),
    (0, express_validator_1.param)('recordId')
        .notEmpty()
        .withMessage('Allergy record ID is required')
        .isInt({ min: 1 })
        .withMessage('Invalid allergy record ID'),
    (0, express_validator_1.body)('reaction')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Reaction must not exceed 500 characters'),
    (0, express_validator_1.body)('severity')
        .optional()
        .isIn(['MILD', 'MODERATE', 'SEVERE', 'ANAPHYLACTIC'])
        .withMessage('Invalid severity value'),
    (0, express_validator_1.body)('status')
        .optional()
        .isIn(['ACTIVE', 'INACTIVE', 'RESOLVED'])
        .withMessage('Invalid status value'),
    (0, express_validator_1.body)('clinicalNotes')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Clinical notes must not exceed 1000 characters'),
    (0, express_validator_1.body)('updatedBy')
        .optional()
        .isLength({ max: 20 })
        .withMessage('updatedBy must not exceed 20 characters'),
];
exports.createPatientComorbidityValidation = [
    (0, express_validator_1.param)('patientId')
        .notEmpty()
        .withMessage('Patient ID is required')
        .isLength({ max: 20 })
        .withMessage('Invalid patient ID'),
    (0, express_validator_1.body)('diagnosisId')
        .notEmpty()
        .withMessage('Diagnosis ID is required')
        .isLength({ max: 20 })
        .withMessage('Invalid diagnosis ID'),
    (0, express_validator_1.body)('status')
        .optional()
        .isIn(['ACTIVE', 'INACTIVE', 'HISTORY', 'RESOLVED'])
        .withMessage('Invalid status value'),
    (0, express_validator_1.body)('onsetDate')
        .optional()
        .isISO8601()
        .withMessage('Onset date must be a valid date (YYYY-MM-DD)'),
    (0, express_validator_1.body)('identifiedBy')
        .optional()
        .isLength({ max: 20 })
        .withMessage('identifiedBy must not exceed 20 characters'),
    (0, express_validator_1.body)('identifiedAtEncounterNo')
        .optional()
        .isLength({ max: 30 })
        .withMessage('Invalid encounter number'),
    (0, express_validator_1.body)('clinicalNotes')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Clinical notes must not exceed 1000 characters'),
];
exports.updatePatientComorbidityValidation = [
    (0, express_validator_1.param)('patientId')
        .notEmpty()
        .withMessage('Patient ID is required')
        .isLength({ max: 20 })
        .withMessage('Invalid patient ID'),
    (0, express_validator_1.param)('recordId')
        .notEmpty()
        .withMessage('Comorbidity record ID is required')
        .isInt({ min: 1 })
        .withMessage('Invalid comorbidity record ID'),
    (0, express_validator_1.body)('status')
        .optional()
        .isIn(['ACTIVE', 'INACTIVE', 'HISTORY', 'RESOLVED'])
        .withMessage('Invalid status value'),
    (0, express_validator_1.body)('onsetDate')
        .optional()
        .isISO8601()
        .withMessage('Onset date must be a valid date (YYYY-MM-DD)'),
    (0, express_validator_1.body)('clinicalNotes')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Clinical notes must not exceed 1000 characters'),
    (0, express_validator_1.body)('updatedBy')
        .optional()
        .isLength({ max: 20 })
        .withMessage('updatedBy must not exceed 20 characters'),
];
exports.getClinicalDetailsValidation = [
    (0, express_validator_1.param)('encounterNo')
        .notEmpty()
        .withMessage('Encounter number is required')
        .isLength({ max: 30 })
        .withMessage('Invalid encounter number'),
];
exports.getMasterListValidation = [
    (0, express_validator_1.query)('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    (0, express_validator_1.query)('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    (0, express_validator_1.query)('search')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Search term must not exceed 100 characters'),
    (0, express_validator_1.query)('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean'),
];
