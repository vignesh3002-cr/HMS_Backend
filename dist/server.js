"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const user_routes_1 = __importDefault(require("./modules/auth/user/user.routes"));
const branch_routes_1 = __importDefault(require("./modules/branch/branch.routes"));
const employee_routes_1 = __importDefault(require("./modules/employee/employee.routes"));
const department_routes_1 = __importDefault(require("./modules/department/department.routes"));
const bcrypt_1 = require("./utils/bcrypt");
// Fix BigInt serialization - Prisma returns BigInt types that JSON.stringify can't handle
BigInt.prototype.toJSON = function () {
    return this.toString();
};
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get("/api/health", (_req, res) => {
    res.json({ success: true, message: "Server is running" });
});
app.use("/api/auth", auth_routes_1.default);
app.use("/api/employees", employee_routes_1.default);
app.use("/api/users", user_routes_1.default);
//app.use("/api/doctors", doctorRoutes);
app.use("/api/branch", branch_routes_1.default);
app.use("/api/departments", department_routes_1.default);
app.use("/api/hashpassword", async (req, res) => {
    const { password } = req.body;
    const hashedPassword = await (0, bcrypt_1.hashPassword)(password);
    res.json({ hashedPassword });
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
