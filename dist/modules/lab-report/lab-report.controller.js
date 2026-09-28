"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabReportController = void 0;
const lab_report_service_1 = require("./lab-report.service");
const service = new lab_report_service_1.LabReportService();
class LabReportController {
    async getAll(req, res) {
        try {
            const reports = await service.getAll();
            return res.json({
                success: true,
                data: reports,
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }
    async getById(req, res) {
        try {
            const id = String(req.params.id);
            const report = await service.getById(id);
            return res.json({
                success: true,
                data: report,
            });
        }
        catch (error) {
            return res.status(404).json({
                success: false,
                message: error.message,
            });
        }
    }
    async getByOrderId(req, res) {
        try {
            const orderId = String(req.params.orderId);
            const report = await service.getByOrderId(orderId);
            return res.json({
                success: true,
                data: report,
            });
        }
        catch (error) {
            return res.status(404).json({
                success: false,
                message: error.message,
            });
        }
    }
    async create(req, res) {
        try {
            const { lab_order_id } = req.body;
            if (!lab_order_id) {
                return res.status(400).json({
                    success: false,
                    message: "lab_order_id is required",
                });
            }
            const report = await service.create(req.body);
            return res.status(201).json({
                success: true,
                message: "Report created and saved successfully",
                data: report,
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }
    async update(req, res) {
        try {
            const id = String(req.params.id);
            const updated = await service.update(id, req.body);
            return res.json({
                success: true,
                message: "Report updated successfully",
                data: updated,
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }
    async transfer(req, res) {
        try {
            const id = String(req.params.id);
            const { delivered_to } = req.body;
            if (!delivered_to) {
                return res.status(400).json({
                    success: false,
                    message: "delivered_to recipient is required for transfer",
                });
            }
            const transferred = await service.transfer(id, req.body);
            return res.json({
                success: true,
                message: "Report transferred and dispatched successfully",
                data: transferred,
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }
    async delete(req, res) {
        try {
            const id = String(req.params.id);
            await service.delete(id);
            return res.json({
                success: true,
                message: "Report deleted successfully",
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }
}
exports.LabReportController = LabReportController;
