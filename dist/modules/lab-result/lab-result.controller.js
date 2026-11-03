"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabResultController = void 0;
const lab_result_service_1 = require("./lab-result.service");
const service = new lab_result_service_1.LabResultService();
class LabResultController {
    async getByOrderItemId(req, res) {
        try {
            const orderItemId = String(req.params.orderItemId);
            const results = await service.getByOrderItemId(orderItemId);
            return res.json({
                success: true,
                data: results
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async getById(req, res) {
        try {
            const id = String(req.params.id);
            const result = await service.getById(id);
            return res.json({
                success: true,
                data: result
            });
        }
        catch (error) {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
    }
    async create(req, res) {
        try {
            const result = await service.create(req.body);
            return res.status(201).json({
                success: true,
                data: result
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async batchSave(req, res) {
        try {
            const user = req.user;
            const payload = {
                ...req.body,
                verified_by: req.body.verified_by || user?.employee_id || user?.username,
                user_id: user?.user_id || req.body.user_id,
                branch_id: req.body.branch_id || req.headers["x-branch-id"]
            };
            const result = await service.batchSave(payload);
            return res.status(200).json({
                success: true,
                message: req.body.markCompleted
                    ? "Lab test results saved and marked as completed successfully."
                    : "Lab test draft results saved successfully.",
                data: result
            });
        }
        catch (error) {
            console.error("Batch save error:", error);
            return res.status(400).json({
                success: false,
                message: error.message || "Failed to batch save lab results"
            });
        }
    }
    async update(req, res) {
        try {
            const id = String(req.params.id);
            const updated = await service.update(id, req.body);
            return res.json({
                success: true,
                data: updated
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async delete(req, res) {
        try {
            const id = String(req.params.id);
            await service.delete(id);
            return res.json({
                success: true,
                message: "Lab result deleted successfully"
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
}
exports.LabResultController = LabResultController;
