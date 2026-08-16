import { body, param, query } from 'express-validator';

export const createPerformanceStatusValidation = [
    body('code')
        .notEmpty()
        .withMessage('Code is required')
        .isLength({ max: 20 })
        .withMessage('Code must not exceed 20 characters')
        .matches(/^[A-Z0-9_]+$/)
        .withMessage('Code must be uppercase alphanumeric with underscores'),
    body('description')
        .notEmpty()
        .withMessage('Description is required')
        .isLength({ max: 200 })
        .withMessage('Description must not exceed 200 characters'),
    body('displayOrder')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Display order must be a non-negative integer'),
    body('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean'),
    body('createdBy')
        .optional()
        .isLength({ max: 20 })
        .withMessage('createdBy must not exceed 20 characters'),
];

export const updatePerformanceStatusValidation = [
    param('id')
        .notEmpty()
        .withMessage('Performance status ID is required')
        .isInt({ min: 1 })
        .withMessage('Invalid performance status ID'),
    body('description')
        .optional()
        .isLength({ max: 200 })
        .withMessage('Description must not exceed 200 characters'),
    body('displayOrder')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Display order must be a non-negative integer'),
    body('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean'),
    body('updatedBy')
        .optional()
        .isLength({ max: 20 })
        .withMessage('updatedBy must not exceed 20 characters'),
];

export const createSymptomValidation = [
    body('code')
        .notEmpty()
        .withMessage('Code is required')
        .isLength({ max: 30 })
        .withMessage('Code must not exceed 30 characters')
        .matches(/^[A-Z0-9_]+$/)
        .withMessage('Code must be uppercase alphanumeric with underscores'),
    body('name')
        .notEmpty()
        .withMessage('Name is required')
        .isLength({ max: 150 })
        .withMessage('Name must not exceed 150 characters'),
    body('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Description must not exceed 500 characters'),
    body('category')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Category must not exceed 100 characters'),
    body('bodySystem')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Body system must not exceed 100 characters'),
    body('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean'),
    body('createdBy')
        .optional()
        .isLength({ max: 20 })
        .withMessage('createdBy must not exceed 20 characters'),
];

export const updateSymptomValidation = [
    param('id')
        .notEmpty()
        .withMessage('Symptom ID is required')
        .isInt({ min: 1 })
        .withMessage('Invalid symptom ID'),
    body('name')
        .optional()
        .isLength({ max: 150 })
        .withMessage('Name must not exceed 150 characters'),
    body('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Description must not exceed 500 characters'),
    body('category')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Category must not exceed 100 characters'),
    body('bodySystem')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Body system must not exceed 100 characters'),
    body('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean'),
    body('updatedBy')
        .optional()
        .isLength({ max: 20 })
        .withMessage('updatedBy must not exceed 20 characters'),
];

export const createAllergyValidation = [
    body('code')
        .notEmpty()
        .withMessage('Code is required')
        .isLength({ max: 30 })
        .withMessage('Code must not exceed 30 characters')
        .matches(/^[A-Z0-9_]+$/)
        .withMessage('Code must be uppercase alphanumeric with underscores'),
    body('substanceName')
        .notEmpty()
        .withMessage('Substance name is required')
        .isLength({ max: 150 })
        .withMessage('Substance name must not exceed 150 characters'),
    body('substanceType')
        .notEmpty()
        .withMessage('Substance type is required')
        .isLength({ max: 100 })
        .withMessage('Substance type must not exceed 100 characters'),
    body('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Description must not exceed 500 characters'),
    body('severityLevel')
        .optional()
        .isLength({ max: 30 })
        .withMessage('Severity level must not exceed 30 characters'),
    body('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean'),
    body('createdBy')
        .optional()
        .isLength({ max: 20 })
        .withMessage('createdBy must not exceed 20 characters'),
];

export const updateAllergyValidation = [
    param('id')
        .notEmpty()
        .withMessage('Allergy ID is required')
        .isInt({ min: 1 })
        .withMessage('Invalid allergy ID'),
    body('substanceName')
        .optional()
        .isLength({ max: 150 })
        .withMessage('Substance name must not exceed 150 characters'),
    body('substanceType')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Substance type must not exceed 100 characters'),
    body('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Description must not exceed 500 characters'),
    body('severityLevel')
        .optional()
        .isLength({ max: 30 })
        .withMessage('Severity level must not exceed 30 characters'),
    body('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean'),
    body('updatedBy')
        .optional()
        .isLength({ max: 20 })
        .withMessage('updatedBy must not exceed 20 characters'),
];

export const createEncounterPerformanceStatusValidation = [
    param('encounterNo')
        .notEmpty()
        .withMessage('Encounter number is required')
        .isLength({ max: 30 })
        .withMessage('Invalid encounter number'),
    body('performanceStatusId')
        .notEmpty()
        .withMessage('Performance status ID is required')
        .isInt({ min: 1 })
        .withMessage('Invalid performance status ID'),
    body('assessedBy')
        .optional()
        .isLength({ max: 20 })
        .withMessage('assessedBy must not exceed 20 characters'),
    body('clinicalNotes')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Clinical notes must not exceed 1000 characters'),
];

export const createEncounterSymptomValidation = [
    param('encounterNo')
        .notEmpty()
        .withMessage('Encounter number is required')
        .isLength({ max: 30 })
        .withMessage('Invalid encounter number'),
    body('symptomId')
        .notEmpty()
        .withMessage('Symptom ID is required')
        .isInt({ min: 1 })
        .withMessage('Invalid symptom ID'),
    body('severity')
        .optional()
        .isIn(['MILD', 'MODERATE', 'SEVERE', 'CRITICAL'])
        .withMessage('Invalid severity value'),
    body('durationDays')
        .optional()
        .isInt({ min: 0, max: 9999 })
        .withMessage('Duration days must be between 0 and 9999'),
    body('onsetDate')
        .optional()
        .isISO8601()
        .withMessage('Onset date must be a valid date (YYYY-MM-DD)'),
    body('clinicalNotes')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Clinical notes must not exceed 1000 characters'),
    body('recordedBy')
        .optional()
        .isLength({ max: 20 })
        .withMessage('recordedBy must not exceed 20 characters'),
];

export const updateEncounterSymptomValidation = [
    param('encounterNo')
        .notEmpty()
        .withMessage('Encounter number is required')
        .isLength({ max: 30 })
        .withMessage('Invalid encounter number'),
    param('symptomId')
        .notEmpty()
        .withMessage('Symptom ID is required')
        .isInt({ min: 1 })
        .withMessage('Invalid symptom ID'),
    body('severity')
        .optional()
        .isIn(['MILD', 'MODERATE', 'SEVERE', 'CRITICAL'])
        .withMessage('Invalid severity value'),
    body('durationDays')
        .optional()
        .isInt({ min: 0, max: 9999 })
        .withMessage('Duration days must be between 0 and 9999'),
    body('onsetDate')
        .optional()
        .isISO8601()
        .withMessage('Onset date must be a valid date (YYYY-MM-DD)'),
    body('clinicalNotes')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Clinical notes must not exceed 1000 characters'),
    body('status')
        .optional()
        .isIn(['ACTIVE', 'RESOLVED', 'CHRONIC'])
        .withMessage('Invalid status value'),
    body('updatedBy')
        .optional()
        .isLength({ max: 20 })
        .withMessage('updatedBy must not exceed 20 characters'),
];

export const createPatientAllergyValidation = [
    param('patientId')
        .notEmpty()
        .withMessage('Patient ID is required')
        .isLength({ max: 20 })
        .withMessage('Invalid patient ID'),
    body('allergyId')
        .notEmpty()
        .withMessage('Allergy ID is required')
        .isInt({ min: 1 })
        .withMessage('Invalid allergy ID'),
    body('reaction')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Reaction must not exceed 500 characters'),
    body('severity')
        .optional()
        .isIn(['MILD', 'MODERATE', 'SEVERE', 'ANAPHYLACTIC'])
        .withMessage('Invalid severity value'),
    body('status')
        .optional()
        .isIn(['ACTIVE', 'INACTIVE', 'RESOLVED'])
        .withMessage('Invalid status value'),
    body('identifiedBy')
        .optional()
        .isLength({ max: 20 })
        .withMessage('identifiedBy must not exceed 20 characters'),
    body('identifiedAtEncounterNo')
        .optional()
        .isLength({ max: 30 })
        .withMessage('Invalid encounter number'),
    body('clinicalNotes')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Clinical notes must not exceed 1000 characters'),
];

export const updatePatientAllergyValidation = [
    param('patientId')
        .notEmpty()
        .withMessage('Patient ID is required')
        .isLength({ max: 20 })
        .withMessage('Invalid patient ID'),
    param('recordId')
        .notEmpty()
        .withMessage('Allergy record ID is required')
        .isInt({ min: 1 })
        .withMessage('Invalid allergy record ID'),
    body('reaction')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Reaction must not exceed 500 characters'),
    body('severity')
        .optional()
        .isIn(['MILD', 'MODERATE', 'SEVERE', 'ANAPHYLACTIC'])
        .withMessage('Invalid severity value'),
    body('status')
        .optional()
        .isIn(['ACTIVE', 'INACTIVE', 'RESOLVED'])
        .withMessage('Invalid status value'),
    body('clinicalNotes')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Clinical notes must not exceed 1000 characters'),
    body('updatedBy')
        .optional()
        .isLength({ max: 20 })
        .withMessage('updatedBy must not exceed 20 characters'),
];

export const createPatientComorbidityValidation = [
    param('patientId')
        .notEmpty()
        .withMessage('Patient ID is required')
        .isLength({ max: 20 })
        .withMessage('Invalid patient ID'),
    body('diagnosisId')
        .notEmpty()
        .withMessage('Diagnosis ID is required')
        .isLength({ max: 20 })
        .withMessage('Invalid diagnosis ID'),
    body('status')
        .optional()
        .isIn(['ACTIVE', 'INACTIVE', 'HISTORY', 'RESOLVED'])
        .withMessage('Invalid status value'),
    body('onsetDate')
        .optional()
        .isISO8601()
        .withMessage('Onset date must be a valid date (YYYY-MM-DD)'),
    body('identifiedBy')
        .optional()
        .isLength({ max: 20 })
        .withMessage('identifiedBy must not exceed 20 characters'),
    body('identifiedAtEncounterNo')
        .optional()
        .isLength({ max: 30 })
        .withMessage('Invalid encounter number'),
    body('clinicalNotes')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Clinical notes must not exceed 1000 characters'),
];

export const updatePatientComorbidityValidation = [
    param('patientId')
        .notEmpty()
        .withMessage('Patient ID is required')
        .isLength({ max: 20 })
        .withMessage('Invalid patient ID'),
    param('recordId')
        .notEmpty()
        .withMessage('Comorbidity record ID is required')
        .isInt({ min: 1 })
        .withMessage('Invalid comorbidity record ID'),
    body('status')
        .optional()
        .isIn(['ACTIVE', 'INACTIVE', 'HISTORY', 'RESOLVED'])
        .withMessage('Invalid status value'),
    body('onsetDate')
        .optional()
        .isISO8601()
        .withMessage('Onset date must be a valid date (YYYY-MM-DD)'),
    body('clinicalNotes')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Clinical notes must not exceed 1000 characters'),
    body('updatedBy')
        .optional()
        .isLength({ max: 20 })
        .withMessage('updatedBy must not exceed 20 characters'),
];

export const getClinicalDetailsValidation = [
    param('encounterNo')
        .notEmpty()
        .withMessage('Encounter number is required')
        .isLength({ max: 30 })
        .withMessage('Invalid encounter number'),
];

export const getMasterListValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    query('search')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Search term must not exceed 100 characters'),
    query('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean'),
];