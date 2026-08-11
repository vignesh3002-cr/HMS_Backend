"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabOrderItemController = void 0;
const express_validator_1 = require("express-validator");
const lab_order_item_service_1 = require("./lab-order-item.service");
const service = new lab_order_item_service_1.LabOrderItemService();
class LabOrderItemController {
    async create(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }
            const item = await service.create(req.body);
            return res.status(201).json({
                success: true,
                data: item
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async getAll(req, res) {
        try {
            const items = await service.getAll();
            return res.json({
                success: true,
                data: items
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
    async getById(req, res) {
        try {
            const item = await service.getById(req.params.id);
            return res.json({
                success: true,
                data: item
            });
        }
        catch (error) {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
    }
    async update(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }
            const item = await service.update(req.params.id, req.body);
            return res.json({
                success: true,
                data: item
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
            await service.delete(req.params.id);
            return res.json({
                success: true,
                message: "Lab Order Item deleted successfully"
            });
        }
        catch (error) {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
    }
}
exports.LabOrderItemController = LabOrderItemController;
