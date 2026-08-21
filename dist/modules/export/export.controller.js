"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportEmployees = exportEmployees;
exports.exportPatients = exportPatients;
exports.exportAppointments = exportAppointments;
const export_service_1 = require("./export.service");
const dateStamp = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const sendCsv = (res, filename, csv) => {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
};
async function exportEmployees(req, res) {
    try {
        const csv = await export_service_1.exportService.buildEmployeesCsv({
            branchId: req.query.branchId,
            roleType: req.query.roleType,
            excludeRoleType: req.query.excludeRoleType,
        });
        sendCsv(res, `employees-${dateStamp()}.csv`, csv);
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
}
async function exportPatients(req, res) {
    try {
        const csv = await export_service_1.exportService.buildPatientsCsv({
            branchId: req.query.branchId,
        });
        sendCsv(res, `patients-${dateStamp()}.csv`, csv);
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
}
async function exportAppointments(req, res) {
    try {
        const csv = await export_service_1.exportService.buildAppointmentsCsv({
            branchId: req.query.branchId,
            from: req.query.from,
            to: req.query.to,
        });
        sendCsv(res, `appointments-${dateStamp()}.csv`, csv);
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
}
