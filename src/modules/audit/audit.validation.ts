import { query } from "express-validator";

export const listAuditLogsValidation = [

    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 200 }),
    query("date_from").optional().isISO8601(),
    query("date_to").optional().isISO8601()

];
