"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const auth_service_1 = require("./modules/auth/auth.service");
async function testLogin() {
    const authService = new auth_service_1.AuthService();
    try {
        const result = await authService.login("admin", "Admin@123");
        console.log(result);
    }
    catch (error) {
        console.error(error);
    }
}
testLogin();
