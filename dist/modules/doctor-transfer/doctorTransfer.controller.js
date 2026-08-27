"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoctorTransferController = void 0;
const express_validator_1 = require("express-validator");
const doctorTransfer_service_1 = require("./doctorTransfer.service");
const service = new doctorTransfer_service_1.DoctorTransferService();
function actingUserId(req) {
    return req.user?.user_id || "SYSTEM";
}
class DoctorTransferController {
    async initiateTransfer(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }
            const bypassHeader = (req.headers['x-bypass-pending-transfer'] || '').toString().toLowerCase();
            const bypassPending = bypassHeader === 'true';
            const authUser = req.user || {};
            const isAdmin = ['HEAD_ADMIN', 'SUPER_ADMIN', 'BRANCH_ADMIN'].includes(authUser.role_type?.toUpperCase());
            const result = await service.initiateTransfer(req.params.employeeId, req.body, actingUserId(req), bypassPending && isAdmin);
            return res.status(201).json({
                success: true,
                message: result.message,
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
    async confirmTransfer(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }
            const result = await service.confirmTransfer(req.params.employeeId, req.body, actingUserId(req));
            return res.json({
                success: true,
                message: `Transfer ${result.action} action completed successfully`,
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
    async getFutureAppointments(req, res) {
        try {
            const result = await service.previewFutureAppointments(req.params.employeeId, req.query.effective_date);
            return res.json({
                success: true,
                message: "Future appointments fetched successfully",
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
    async transferPreview(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }
            const result = await service.previewFutureAppointments(req.body.employee_id, req.body.effective_date);
            return res.json({
                success: true,
                message: "Transfer preview generated successfully",
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
    async getRescheduleQueue(req, res) {
        try {
            const result = await service.getRescheduleQueue({
                branchId: req.query.branchId,
                patientId: req.query.patientId,
                status: req.query.status,
                page: Number(req.query.page || 1),
                limit: Number(req.query.limit || 10)
            });
            return res.json({
                success: true,
                message: "Reschedule queue fetched successfully",
                data: result
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
    async processRescheduleAction(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }
            const result = await service.processRescheduleQueueAction(req.params.appointmentId, req.body, actingUserId(req));
            return res.json({
                success: true,
                message: `Reschedule request ${result.status.toLowerCase()} successfully`,
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
}
exports.DoctorTransferController = DoctorTransferController;
