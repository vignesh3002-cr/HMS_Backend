"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportIdValidation = exports.updateReportValidation = exports.addReportValidation = exports.upsertPersonalHistoryValidation = exports.getPersonalHistoryValidation = exports.createCustomMasterValidation = exports.listMasterValidation = void 0;
const express_validator_1 = require("express-validator");
exports.listMasterValidation = [
    (0, express_validator_1.query)("search").optional().isString(),
    (0, express_validator_1.query)("isActive").optional().isBoolean()
];
exports.createCustomMasterValidation = [
    (0, express_validator_1.body)("name")
        .notEmpty()
        .withMessage("name is required")
        .isString()
        .isLength({ max: 100 }),
    (0, express_validator_1.body)("description").optional({ nullable: true }).isString()
];
exports.getPersonalHistoryValidation = [
    (0, express_validator_1.param)("encounterNo").notEmpty().withMessage("encounterNo is required")
];
exports.upsertPersonalHistoryValidation = [
    (0, express_validator_1.param)("encounterNo").notEmpty().withMessage("encounterNo is required"),
    (0, express_validator_1.body)("immunization").optional({ nullable: true }).isArray(),
    (0, express_validator_1.body)("immunization.*.code").optional().isString(),
    (0, express_validator_1.body)("immunization.*.name").optional().isString(),
    (0, express_validator_1.body)("immunization.*.others").optional({ nullable: true }).isString(),
    (0, express_validator_1.body)("drug_consumption").optional({ nullable: true }).isArray(),
    (0, express_validator_1.body)("drug_consumption.*.code").optional().isString(),
    (0, express_validator_1.body)("drug_consumption.*.name").optional().isString(),
    (0, express_validator_1.body)("drug_consumption.*.others").optional({ nullable: true }).isString(),
    (0, express_validator_1.body)("diet_type").optional({ nullable: true }).isString()
];
exports.addReportValidation = [
    (0, express_validator_1.param)("encounterNo").notEmpty().withMessage("encounterNo is required"),
    (0, express_validator_1.body)("lab_test_id").notEmpty().withMessage("lab_test_id is required"),
    (0, express_validator_1.body)("report_completed_date").optional({ nullable: true }).isISO8601(),
    (0, express_validator_1.body)("result").optional({ nullable: true }).isString(),
    (0, express_validator_1.body)("impression").optional({ nullable: true }).isString()
];
exports.updateReportValidation = [
    (0, express_validator_1.param)("encounterReportId").notEmpty().withMessage("encounterReportId is required"),
    (0, express_validator_1.body)("lab_test_id").optional().notEmpty(),
    (0, express_validator_1.body)("report_completed_date").optional({ nullable: true }).isISO8601(),
    (0, express_validator_1.body)("result").optional({ nullable: true }).isString(),
    (0, express_validator_1.body)("impression").optional({ nullable: true }).isString()
];
exports.reportIdValidation = [
    (0, express_validator_1.param)("encounterReportId").notEmpty().withMessage("encounterReportId is required")
];
