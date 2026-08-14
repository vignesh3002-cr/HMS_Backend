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
import permissionRoutes from "./modules/permission/permission.routes";
import roleRoutes from "./modules/role/role.routes";
import prescriptionRoutes from "./modules/prescription/prescription.routes";
import chemotherapyRoutes from "./modules/chemotherapy/chemotherapy.routes";
import oncologyRoutes from "./modules/oncology/oncology.routes";
import auditRoutes from "./modules/audit/audit.routes";
import exportRoutes from "./modules/export/export.routes";
import doctorTransferRoutes from "./modules/doctor-transfer/doctorTransfer.routes";
import labTestCategoryRoutes from "./modules/lab-test-category/lab-test-category.routes";
import labTestMasterRoutes from "./modules/lab-test-master/lab-test-master.routes";
import labOrderRoutes from "./modules/lab-order/lab-order-routes";
import cookieParser from "cookie-parser";
import labOrderItemRoutes from "./modules/lab-order-item/lab-order-item.routes";
import qualificationMasterRoutes from "./modules/qualification-master/qualification-master.routes";
import diagnosisRoutes from "./modules/diagnosis/diagnosis.routes";


import { hashPassword } from "./utils/bcrypt";

// Fix BigInt serialization - Prisma returns BigInt types that JSON.stringify can't handle
(BigInt.prototype as any).toJSON = function () {
    return this.toString();
};

const app = express();

const configuredOrigins = (
  process.env.FRONTEND_URL || "http://localhost:5173"
)
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

const isAllowedOrigin = (origin: string | undefined) => {
  if (!origin) return true;

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  return /^https:\/\/.*\.vercel\.app$/i.test(origin);
};

app.use(
  cors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
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
  })
);

app.use(express.json());
app.use(cookieParser());


app.get("/api/health", (_req, res) => {
    res.json({ success: true, message: "Server is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/users", userRoutes);
app.use("/api/branch", branchRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/lab-test-category", labTestCategoryRoutes);
app.use("/api/lab-test-master", labTestMasterRoutes);
app.use("/api/lab-order", labOrderRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/chemotherapy", chemotherapyRoutes);
app.use("/api/lab-order-item", labOrderItemRoutes);
app.use("/api/encounters", encounterRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/chemotherapy", chemotherapyRoutes);
app.use("/api/lab-order-item", labOrderItemRoutes);
app.use("/api/oncology", oncologyRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/doctors", doctorTransferRoutes);
app.use("/api/qualification-master", qualificationMasterRoutes);
app.use("/api/diagnosis", diagnosisRoutes);
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