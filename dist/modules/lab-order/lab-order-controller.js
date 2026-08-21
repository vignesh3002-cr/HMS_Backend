"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_validator_1 = require("express-validator");
const lab_order_service_1 = __importDefault(require("./lab-order-service"));
class LabOrderController {
    async create(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }
            const order = await lab_order_service_1.default.create(req.body);
            return res.status(201).json({
                success: true,
                message: "Lab Order created successfully",
                data: order
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
            const orders = await lab_order_service_1.default.getAll();
            return res.status(200).json({
                success: true,
                data: orders
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
            const order = await lab_order_service_1.default.getById(String(req.params.id));
            return res.status(200).json({
                success: true,
                data: order
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
            const order = await lab_order_service_1.default.update(String(req.params.id), req.body);
            return res.status(200).json({
                success: true,
                message: "Lab Order updated successfully",
                data: order
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
            await lab_order_service_1.default.delete(String(req.params.id));
            return res.status(200).json({
                success: true,
                message: "Lab Order deleted successfully"
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
exports.default = new LabOrderController();
