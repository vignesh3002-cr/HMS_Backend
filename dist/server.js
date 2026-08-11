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
const patient_routes_1 = __importDefault(require("./modules/patient/patient.routes"));
const appointment_routes_1 = __importDefault(require("./modules/appointment/appointment.routes"));
const encounter_routes_1 = __importDefault(require("./modules/encounter/encounter.routes"));
const permission_routes_1 = __importDefault(require("./modules/permission/permission.routes"));
const role_routes_1 = __importDefault(require("./modules/role/role.routes"));
const prescription_routes_1 = __importDefault(require("./modules/prescription/prescription.routes"));
const chemotherapy_routes_1 = __importDefault(require("./modules/chemotherapy/chemotherapy.routes"));
const oncology_routes_1 = __importDefault(require("./modules/oncology/oncology.routes"));
const audit_routes_1 = __importDefault(require("./modules/audit/audit.routes"));
const export_routes_1 = __importDefault(require("./modules/export/export.routes"));
const doctorTransfer_routes_1 = __importDefault(require("./modules/doctor-transfer/doctorTransfer.routes"));
const lab_test_category_routes_1 = __importDefault(require("./modules/lab-test-category/lab-test-category.routes"));
const lab_test_master_routes_1 = __importDefault(require("./modules/lab-test-master/lab-test-master.routes"));
const lab_order_routes_1 = __importDefault(require("./modules/lab-order/lab-order-routes"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const lab_order_item_routes_1 = __importDefault(require("./modules/lab-order-item/lab-order-item.routes"));
const qualification_master_routes_1 = __importDefault(require("./modules/qualification-master/qualification-master.routes"));
const bcrypt_1 = require("./utils/bcrypt");
// Fix BigInt serialization - Prisma returns BigInt types that JSON.stringify can't handle
BigInt.prototype.toJSON = function () {
    return this.toString();
};
const app = (0, express_1.default)();
const configuredOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
const allowedOrigins = [
    ...configuredOrigins,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
];
const isAllowedOrigin = (origin) => {
    if (!origin)
        return true;
    if (allowedOrigins.includes(origin)) {
        return true;
    }
    return /^https:\/\/.*\.vercel\.app$/i.test(origin);
};
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error(`Not allowed by CORS: ${origin}`));
        }
    },
    credentials: true,
    methods: [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
    ],
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "x-branch-id",
        "X-Requested-With",
        "Cache-Control",
        "Accept",
        "Origin",
        "Referer",
        "User-Agent",
    ],
    optionsSuccessStatus: 200,
}));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.get("/api/health", (_req, res) => {
    res.json({ success: true, message: "Server is running" });
});
app.use("/api/auth", auth_routes_1.default);
app.use("/api/employees", employee_routes_1.default);
app.use("/api/users", user_routes_1.default);
app.use("/api/branch", branch_routes_1.default);
app.use("/api/departments", department_routes_1.default);
app.use("/api/patients", patient_routes_1.default);
app.use("/api/appointments", appointment_routes_1.default);
app.use("/api/lab-test-category", lab_test_category_routes_1.default);
app.use("/api/lab-test-master", lab_test_master_routes_1.default);
app.use("/api/lab-order", lab_order_routes_1.default);
app.use("/api/prescriptions", prescription_routes_1.default);
app.use("/api/chemotherapy", chemotherapy_routes_1.default);
app.use("/api/appointments", appointment_routes_1.default);
app.use("/api/lab-order-item", lab_order_item_routes_1.default);
app.use("/api/encounters", encounter_routes_1.default);
app.use("/api/permissions", permission_routes_1.default);
app.use("/api/roles", role_routes_1.default);
app.use("/api/prescriptions", prescription_routes_1.default);
app.use("/api/chemotherapy", chemotherapy_routes_1.default);
app.use("/api/oncology", oncology_routes_1.default);
app.use("/api/audit", audit_routes_1.default);
app.use("/api/export", export_routes_1.default);
app.use("/api/doctors", doctorTransfer_routes_1.default);
app.use("/api/qualification-master", qualification_master_routes_1.default);
app.use("/api/appointments", appointment_routes_1.default);
app.use("/api/encounters", encounter_routes_1.default);
app.use("/api/prescriptions", prescription_routes_1.default);
app.use("/api/chemotherapy", chemotherapy_routes_1.default);
app.use("/api/doctors", doctorTransfer_routes_1.default);
app.use("/api/hashpassword", async (req, res) => {
    const { password } = req.body;
    const hashedPassword = await (0, bcrypt_1.hashPassword)(password);
    res.json({ hashedPassword });
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
