"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportService = exports.ExportService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const csv_1 = require("../../utils/csv");
// Secrets / credentials / PII that must never appear in any export.
const EXCLUDED_COLUMNS = new Set([
    "username",
    "password",
    "password_hash",
    "otp",
    "refresh_token",
    "reset_token",
    "aadhaar_no",
    "pan_no",
    "passport_no",
]);
// Photo URLs are personal image data and are excluded as well.
const isPhotoColumn = (key) => /photo|picture|avatar/i.test(key);
// Helper: flatten row so only plain scalar columns remain, plus the readable
// relation columns appended at the end. Returns { row, columns } where columns
// is the final column order (first row's scalar order + readable columns).
function toCsvRows(rows, relationKeys, readableColumns) {
    const flat = rows.map((row) => {
        const rest = { ...row };
        for (const key of relationKeys)
            delete rest[key];
        for (const col of readableColumns)
            rest[col.key] = col.value(row);
        return rest;
    });
    const allKeys = flat[0] ? Object.keys(flat[0]) : [];
    const columns = allKeys.filter((key) => !EXCLUDED_COLUMNS.has(key) && !isPhotoColumn(key));
    return { rows: flat, columns };
}
const formatBranchName = (branch) => branch ? (branch.branch_area ? `${branch.branch_name} (${branch.branch_area})` : branch.branch_name) : "";
class ExportService {
    // All employees of the branch scope (deleted rows excluded). Optional
    // roleType / excludeRoleType narrows the export (Doctor page, Staff page).
    async buildEmployeesCsv(query) {
        const userTableWhere = {};
        if (query.roleType)
            userTableWhere.role_type = query.roleType;
        if (query.excludeRoleType)
            userTableWhere.role_type = { not: query.excludeRoleType };
        const employees = await prisma_1.default.employees.findMany({
            where: {
                deleted_at: null,
                ...(query.branchId ? { branch_id: query.branchId } : {}),
                ...(Object.keys(userTableWhere).length ? { user_table: userTableWhere } : {}),
            },
            include: {
                user_table: { select: { role_type: true } },
                branch: { select: { branch_name: true, branch_area: true } },
                department_master: { select: { department_name: true } },
            },
            orderBy: { id: "asc" },
        });
        const { rows, columns } = toCsvRows(employees, ["user_table", "branch", "department_master"], [
            { key: "role_type", value: (e) => e.user_table?.role_type ?? "" },
            { key: "branch_name", value: (e) => formatBranchName(e.branch) },
            { key: "department_name", value: (e) => e.department_master?.department_name ?? "" },
        ]);
        return (0, csv_1.toCsv)(rows, columns);
    }
    // All patients of the branch scope.
    async buildPatientsCsv(query) {
        const patients = await prisma_1.default.patient_bio_data.findMany({
            where: query.branchId ? { branch_id: query.branchId } : {},
            include: { branch: { select: { branch_name: true, branch_area: true } } },
            orderBy: { id: "asc" },
        });
        const { rows, columns } = toCsvRows(patients, ["branch"], [
            { key: "branch_name", value: (p) => formatBranchName(p.branch) },
        ]);
        return (0, csv_1.toCsv)(rows, columns);
    }
    // All appointments of the branch scope, optionally narrowed to a date
    // range (Day view: same from/to; Week view: week start/end).
    async buildAppointmentsCsv(query) {
        const from = query.from ? new Date(query.from) : undefined;
        const to = query.to ? new Date(query.to) : undefined;
        const appointments = await prisma_1.default.appointment_history.findMany({
            where: {
                ...(query.branchId ? { branch_id: query.branchId } : {}),
                ...(from || to
                    ? {
                        appointment_date: {
                            ...(from ? { gte: from } : {}),
                            ...(to ? { lte: to } : {}),
                        },
                    }
                    : {}),
            },
            include: {
                branch: { select: { branch_name: true, branch_area: true } },
                department_master: { select: { department_name: true } },
                patient_bio_data: {
                    select: { patient_first_name: true, patient_last_name: true },
                },
            },
            orderBy: { id: "asc" },
        });
        const { rows, columns } = toCsvRows(appointments, ["branch", "department_master", "patient_bio_data"], [
            {
                key: "patient_name",
                value: (a) => a.patient_bio_data
                    ? `${a.patient_bio_data.patient_first_name} ${a.patient_bio_data.patient_last_name ?? ""}`.trim()
                    : "",
            },
            { key: "branch_name", value: (a) => formatBranchName(a.branch) },
            { key: "department_name", value: (a) => a.department_master?.department_name ?? "" },
        ]);
        return (0, csv_1.toCsv)(rows, columns);
    }
}
exports.ExportService = ExportService;
exports.exportService = new ExportService();
