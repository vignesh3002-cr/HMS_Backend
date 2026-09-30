"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportIdValidation = exports.molecularTestIdValidation = exports.updateMolecularTestValidation = exports.addMolecularTestValidation = exports.updateReportValidation = exports.addReportValidation = exports.upsertPersonalHistoryValidation = exports.getPersonalHistoryValidation = exports.createCustomMasterValidation = exports.listMasterValidation = void 0;
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
    (0, express_validator_1.body)("lab_test_id").optional({ nullable: true }).isString(),
    (0, express_validator_1.body)("test_name").optional({ nullable: true }).isString().isLength({ max: 200 }),
    (0, express_validator_1.body)().custom((value) => {
        if (!value?.lab_test_id && !String(value?.test_name ?? "").trim()) {
            throw new Error("Select a lab test or type the test name");
        }
        return true;
    }),
    (0, express_validator_1.body)("report_completed_date").optional({ nullable: true }).isISO8601(),
    (0, express_validator_1.body)("result").optional({ nullable: true }).isString(),
    (0, express_validator_1.body)("impression").optional({ nullable: true }).isString()
];
exports.updateReportValidation = [
    (0, express_validator_1.param)("encounterReportId").notEmpty().withMessage("encounterReportId is required"),
    (0, express_validator_1.body)("lab_test_id").optional({ nullable: true }).isString(),
    (0, express_validator_1.body)("test_name").optional({ nullable: true }).isString().isLength({ max: 200 }),
    (0, express_validator_1.body)("report_completed_date").optional({ nullable: true }).isISO8601(),
    (0, express_validator_1.body)("result").optional({ nullable: true }).isString(),
    (0, express_validator_1.body)("impression").optional({ nullable: true }).isString()
];
exports.addMolecularTestValidation = [
    (0, express_validator_1.param)("encounterNo").notEmpty().withMessage("encounterNo is required"),
    (0, express_validator_1.body)("test_name").isString().trim().notEmpty().withMessage("test_name is required").isLength({ max: 200 }),
    (0, express_validator_1.body)("test_date").optional({ nullable: true }).isISO8601(),
    (0, express_validator_1.body)("result").optional({ nullable: true }).isString(),
    (0, express_validator_1.body)("impression").optional({ nullable: true }).isString()
];
exports.updateMolecularTestValidation = [
    (0, express_validator_1.param)("encounterMolecularTestId").notEmpty().withMessage("encounterMolecularTestId is required"),
    (0, express_validator_1.body)("test_name").optional().isString().trim().notEmpty().withMessage("test_name cannot be blank").isLength({ max: 200 }),
    (0, express_validator_1.body)("test_date").optional({ nullable: true }).isISO8601(),
    (0, express_validator_1.body)("result").optional({ nullable: true }).isString(),
    (0, express_validator_1.body)("impression").optional({ nullable: true }).isString()
];
exports.molecularTestIdValidation = [
    (0, express_validator_1.param)("encounterMolecularTestId").notEmpty().withMessage("encounterMolecularTestId is required")
];
exports.reportIdValidation = [
    (0, express_validator_1.param)("encounterReportId").notEmpty().withMessage("encounterReportId is required")
];
