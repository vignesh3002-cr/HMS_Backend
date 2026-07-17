"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const user_service_1 = require("./user.service");
const userService = new user_service_1.UserService();
class UserController {
    async createBranchAdmin(req, res) {
        try {
            const result = await userService.createBranchAdmin(req.body, req.user?.id);
            return res.status(201).json({
                success: true,
                message: result.message,
                data: result.user
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
exports.UserController = UserController;
