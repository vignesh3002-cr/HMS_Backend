"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAuditLogsValidation = void 0;
const express_validator_1 = require("express-validator");
exports.listAuditLogsValidation = [
    (0, express_validator_1.query)("page").optional().isInt({ min: 1 }),
    (0, express_validator_1.query)("limit").optional().isInt({ min: 1, max: 200 }),
    (0, express_validator_1.query)("date_from").optional().isISO8601(),
    (0, express_validator_1.query)("date_to").optional().isISO8601()
];
