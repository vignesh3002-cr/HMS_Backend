"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = require("./auth.service");
const authService = new auth_service_1.AuthService();
class AuthController {
    async login(req, res) {
        try {
            const { username, password } = req.body;
            const result = await authService.login(username, password);
            return res.status(200).json({
                success: true,
                message: "Login Successful",
                data: result
            });
        }
        catch (error) {
            return res.status(401).json({
                success: false,
                message: error.message
            });
        }
    }
}
exports.AuthController = AuthController;
