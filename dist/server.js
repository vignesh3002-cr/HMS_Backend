"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_dns_1 = __importDefault(require("node:dns"));
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const user_routes_1 = __importDefault(require("./modules/auth/user/user.routes"));
const branch_routes_1 = __importDefault(require("./modules/branch/branch.routes"));
const employee_routes_1 = __importDefault(require("./modules/employee/employee.routes"));
const department_routes_1 = __importDefault(require("./modules/department/department.routes"));
const patient_routes_1 = __importDefault(require("./modules/patient/patient.routes"));
const appointment_routes_1 = __importDefault(require("./modules/appointment/appointment.routes"));
const lab_test_category_routes_1 = __importDefault(require("./modules/lab-test-category/lab-test-category.routes"));
const lab_test_master_routes_1 = __importDefault(require("./modules/lab-test-master/lab-test-master.routes"));
const lab_order_routes_1 = __importDefault(require("./modules/lab-order/lab-order-routes"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const chemotherapy_routes_1 = __importDefault(require("./modules/chemotherapy/chemotherapy.routes"));
const bcrypt_1 = require("./utils/bcrypt");
node_dns_1.default.setDefaultResultOrder("ipv4first");
// Fix BigInt serialization - Prisma returns BigInt types that JSON.stringify can't handle
BigInt.prototype.toJSON = function () {
    return this.toString();
};
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.use((0, cors_1.default)());
app.use((0, cookie_parser_1.default)());
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
app.use("/api/patients", patient_routes_1.default);
app.use("/api/lab-test-categories", lab_test_category_routes_1.default);
app.use("/api/lab-test-master", lab_test_master_routes_1.default);
app.use("/api/lab-order", lab_order_routes_1.default);
app.use("/api/chemotherapy", chemotherapy_routes_1.default);
app.use("/api/appointments", appointment_routes_1.default);
app.use("/api/hashpassword", async (req, res) => {
    const { password } = req.body;
    const hashedPassword = await (0, bcrypt_1.hashPassword)(password);
    res.json({ hashedPassword });
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
