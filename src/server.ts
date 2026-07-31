import dns from "node:dns";
import "dotenv/config";

import express from "express";
import cors from "cors";

import authRoutes from "./modules/auth/auth.routes";
import userRoutes from "./modules/auth/user/user.routes";
import branchRoutes from "./modules/branch/branch.routes";
import employeeRoutes from "./modules/employee/employee.routes";
import departmentRoutes from "./modules/department/department.routes";
import patientRoutes from "./modules/patient/patient.routes";
import appointmentRoutes from "./modules/appointment/appointment.routes";
import encounterRoutes from "./modules/encounter/encounter.routes";
//import prescriptionRoutes from "./modules/prescription/prescription.routes";
//import chemotherapyRoutes from "./modules/chemotherapy/chemotherapy.routes";
import doctorTransferRoutes from "./modules/doctor-transfer/doctorTransfer.routes";
import labTestCategoryRoutes from "./modules/lab-test-category/lab-test-category.routes";
import labTestMasterRoutes from "./modules/lab-test-master/lab-test-master.routes";
import labOrderRoutes from "./modules/lab-order/lab-order-routes";
import cookieParser from "cookie-parser";
import chemotherapyRoutes from "./modules/chemotherapy/chemotherapy.routes";
import prescriptionRoutes from "./modules/prescription/prescription.routes";
import { hashPassword } from "./utils/bcrypt";
dns.setDefaultResultOrder("ipv4first");
// Fix BigInt serialization - Prisma returns BigInt types that JSON.stringify can't handle
(BigInt.prototype as any).toJSON = function () {
    return this.toString();
};

const app = express();
app.use(express.json());
app.use(cookieParser());

const configuredOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const allowedOrigins = new Set([
    ...configuredOrigins,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]);

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) {
                callback(null, true);
                return;
            }

            if (allowedOrigins.has(origin)) {
                callback(null, true);
                return;
            }

            callback(new Error(`CORS blocked for origin: ${origin}`));
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "X-Requested-With",
            "Cache-Control",
            "Accept",
            "Origin",
            "Referer",
            "User-Agent",
        ],
        optionsSuccessStatus: 200,
    })
);

app.use(cookieParser());

app.use(express.json());

app.get("/api/health", (_req, res) => {
    res.json({ success: true, message: "Server is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/users", userRoutes);
//app.use("/api/doctors", doctorRoutes);
app.use("/api/branch", branchRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/lab-test-categories", labTestCategoryRoutes);
app.use("/api/lab-test-master", labTestMasterRoutes);
app.use("/api/lab-order", labOrderRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/chemotherapy", chemotherapyRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/encounters", encounterRoutes);
//app.use("/api/prescriptions", prescriptionRoutes);
//app.use("/api/chemotherapy", chemotherapyRoutes);
app.use("/api/doctors", doctorTransferRoutes);
app.use("/api/hashpassword", async (req, res) => {

    const { password } = req.body;

    const hashedPassword = await hashPassword(password);

    res.json({ hashedPassword });

});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {

    console.log(`Server running on port ${PORT}`);

});