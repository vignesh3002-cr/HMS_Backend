"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEncountersValidation = exports.closeEncounterValidation = exports.updateEncounterValidation = exports.createEncounterValidation = void 0;
const express_validator_1 = require("express-validator");
const encounter_constants_1 = require("./encounter.constants");
exports.createEncounterValidation = [
    (0, express_validator_1.body)("appointment_id")
        .notEmpty()
        .withMessage("Appointment is required")
];
exports.updateEncounterValidation = [
    (0, express_validator_1.param)("encounterNo")
        .notEmpty(),
    (0, express_validator_1.body)("chief_complaint").optional().isString(),
    (0, express_validator_1.body)("symptoms").optional().isString(),
    (0, express_validator_1.body)("diagnosis_id").optional().notEmpty(),
    (0, express_validator_1.body)("clinical_notes").optional().isString(),
    (0, express_validator_1.body)("advice").optional().isString(),
    (0, express_validator_1.body)("follow_up_date")
        .optional()
        .isISO8601()
        .withMessage("Follow-up date must be a valid date (YYYY-MM-DD)"),
    (0, express_validator_1.body)("height").optional().isFloat({ min: 0 }),
    (0, express_validator_1.body)("weight").optional().isFloat({ min: 0 }),
    (0, express_validator_1.body)("pulse").optional().isInt({ min: 0 }),
    (0, express_validator_1.body)("systolic_bp").optional().isInt({ min: 0 }),
    (0, express_validator_1.body)("diastolic_bp").optional().isInt({ min: 0 }),
    (0, express_validator_1.body)("temperature").optional().isFloat({ min: 0 }),
    (0, express_validator_1.body)("respiratory_rate").optional().isInt({ min: 0 }),
    (0, express_validator_1.body)("spo2").optional().isInt({ min: 0, max: 100 })
];
exports.closeEncounterValidation = [
    (0, express_validator_1.param)("encounterNo")
        .notEmpty()
];
exports.getEncountersValidation = [
    (0, express_validator_1.query)("page").optional().isInt({ min: 1 }),
    (0, express_validator_1.query)("limit").optional().isInt({ min: 1, max: 100 }),
    (0, express_validator_1.query)("status").optional().isIn(encounter_constants_1.ENCOUNTER_STATUS_VALUES),
    (0, express_validator_1.query)("date").optional().isISO8601(),
    (0, express_validator_1.query)("dateFrom").optional().isISO8601(),
    (0, express_validator_1.query)("dateTo").optional().isISO8601()
];
