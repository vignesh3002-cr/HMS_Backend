"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoctorLeaveController = void 0;
const doctorLeave_service_1 = require("./doctorLeave.service");
const doctorLeave_constants_1 = require("./doctorLeave.constants");
class DoctorLeaveController {
    service = new doctorLeave_service_1.DoctorLeaveService();
    applyLeave = async (req, res) => {
        try {
            const employeeId = String(req.params.employeeId);
            // Get the logged-in user from the JWT.
            // Do NOT trust requested_by from the frontend.
            const authUser = req.user;
            if (!authUser?.user_id) {
                return res.status(401).json({
                    success: false,
                    message: "Authenticated user not found"
                });
            }
            const requestedBy = String(authUser.user_id);
            const role = String(authUser.role ?? "").toUpperCase();
            console.log("employeeId =", employeeId);
            console.log("requestedBy =", requestedBy);
            console.log("role =", role);
            const result = await this.service.applyLeave(employeeId, req.body, requestedBy, role);
            return res.status(201).json({
                success: true,
                ...result
            });
        }
        catch (error) {
            console.error(error);
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    };
    approveLeave = async (req, res) => {
        try {
            const leaveId = String(req.params.leaveId);
            const authUser = req.user;
            if (!authUser?.user_id) {
                return res.status(401).json({
                    success: false,
                    message: "Authenticated user not found"
                });
            }
            // Use the logged-in user's ID.
            // Do NOT trust approved_by from the frontend.
            const approvedBy = String(authUser.user_id);
            console.log("leaveId =", leaveId);
            console.log("approvedBy =", approvedBy);
            const result = await this.service.approveLeave(leaveId, req.body, approvedBy);
            return res.json({
                success: true,
                ...result
            });
        }
        catch (error) {
            console.error(error);
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    };
    rejectLeave = async (req, res) => {
        try {
            const leaveId = String(req.params.leaveId);
            const authUser = req.user;
            if (!authUser?.user_id) {
                return res.status(401).json({
                    success: false,
                    message: "Authenticated user not found"
                });
            }
            // Use logged-in user's ID.
            const rejectedBy = String(authUser.user_id);
            console.log("leaveId =", leaveId);
            console.log("rejectedBy =", rejectedBy);
            const result = await this.service.rejectLeave(leaveId, req.body, rejectedBy);
            return res.json({
                success: true,
                ...result
            });
        }
        catch (error) {
            console.error(error);
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    };
    getDoctorLeaves = async (req, res) => {
        try {
            const result = await this.service.getDoctorLeaves({
                employee_id: req.query.employee_id,
                status: req.query.status,
                page: req.query.page
                    ? Number(req.query.page)
                    : doctorLeave_constants_1.LEAVE_DEFAULT_PAGE,
                limit: req.query.limit
                    ? Number(req.query.limit)
                    : doctorLeave_constants_1.LEAVE_DEFAULT_LIMIT
            });
            return res.json(result);
        }
        catch (error) {
            console.error(error);
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    };
}
exports.DoctorLeaveController = DoctorLeaveController;
