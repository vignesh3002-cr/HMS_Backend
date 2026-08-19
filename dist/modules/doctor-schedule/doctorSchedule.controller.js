"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.doctorScheduleController = void 0;
const doctorSchedule_service_1 = require("./doctorSchedule.service");
class DoctorScheduleController {
    /**
     * POST
     * Create ADD / OVERRIDE / CANCEL schedule change
     */
    async createScheduleChange(req, res) {
        try {
            const payload = req.body;
            const result = await doctorSchedule_service_1.doctorScheduleService.createScheduleChange(payload);
            res.status(201).json({
                success: true,
                message: "Doctor schedule change created successfully",
                data: result,
            });
        }
        catch (error) {
            console.error("Create doctor schedule change error:", error);
            const message = error instanceof Error
                ? error.message
                : "Failed to create doctor schedule change";
            res.status(400).json({
                success: false,
                message,
            });
        }
    }
    /**
     * GET
     * Get all active schedule changes for a doctor
     */
    async getDoctorScheduleChanges(req, res) {
        try {
            const { employeeId } = req.params;
            if (!employeeId) {
                res.status(400).json({
                    success: false,
                    message: "employeeId is required",
                });
                return;
            }
            const result = await doctorSchedule_service_1.doctorScheduleService.getDoctorScheduleChanges(String(employeeId));
            res.status(200).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            console.error("Get doctor schedule changes error:", error);
            const message = error instanceof Error
                ? error.message
                : "Failed to get doctor schedule changes";
            res.status(400).json({
                success: false,
                message,
            });
        }
    }
    /**
     * GET
     * Get schedule changes for a doctor on a specific date
     */
    async getScheduleChangesByDate(req, res) {
        try {
            const { employeeId, date } = req.params;
            if (!employeeId || !date) {
                res.status(400).json({
                    success: false,
                    message: "employeeId and date are required",
                });
                return;
            }
            const result = await doctorSchedule_service_1.doctorScheduleService.getScheduleChangesByDate(String(employeeId), String(date));
            res.status(200).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            console.error("Get schedule changes by date error:", error);
            const message = error instanceof Error
                ? error.message
                : "Failed to get schedule changes";
            res.status(400).json({
                success: false,
                message,
            });
        }
    }
    /**
     * PATCH
     * Update an existing schedule change
     */
    async updateScheduleChange(req, res) {
        try {
            const { changeId } = req.params;
            if (!changeId) {
                res.status(400).json({
                    success: false,
                    message: "changeId is required",
                });
                return;
            }
            const changeIdBigInt = BigInt(String(changeId));
            const payload = req.body;
            const result = await doctorSchedule_service_1.doctorScheduleService.updateScheduleChange(changeIdBigInt, payload);
            res.status(200).json({
                success: true,
                message: "Doctor schedule change updated successfully",
                data: result,
            });
        }
        catch (error) {
            console.error("Update doctor schedule change error:", error);
            const message = error instanceof Error
                ? error.message
                : "Failed to update doctor schedule change";
            res.status(400).json({
                success: false,
                message,
            });
        }
    }
    /**
     * PATCH
     * Deactivate a schedule change
     */
    async cancelScheduleChange(req, res) {
        try {
            const { changeId } = req.params;
            if (!changeId) {
                res.status(400).json({
                    success: false,
                    message: "changeId is required",
                });
                return;
            }
            const changeIdBigInt = BigInt(String(changeId));
            const result = await doctorSchedule_service_1.doctorScheduleService.cancelScheduleChange(changeIdBigInt);
            res.status(200).json({
                success: true,
                message: "Schedule change cancelled successfully",
                data: result,
            });
        }
        catch (error) {
            console.error("Cancel schedule change error:", error);
            const message = error instanceof Error
                ? error.message
                : "Failed to cancel schedule change";
            res.status(400).json({
                success: false,
                message,
            });
        }
    }
}
exports.doctorScheduleController = new DoctorScheduleController();
