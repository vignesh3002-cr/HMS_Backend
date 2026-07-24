import "dotenv/config";

import express from "express";
import cors from "cors";

import authRoutes from "./modules/auth/auth.routes";
import userRoutes from "./modules/auth/user/user.routes";
import drugRoutes from "./modules/drug/drug.routes";
import branchRoutes from "./modules/branch/branch.routes";
import employeeRoutes from "./modules/employee/employee.routes";
import departmentRoutes from "./modules/department/department.routes";
import patientRoutes from "./modules/patient/patient.routes";
import cancerTypeRoutes from "./modules/cancer-type/cancerType.routes";
import cancerStageRoutes from "./modules/cancer-stage/cancerStage.routes";
import tnmStageRoutes from "./modules/tnm-stage/tnmStage.routes";
import histomorphologyRoutes from "./modules/histomorphology/histomorphology.routes";
import histologicalGradeRoutes from "./modules/histological-grade/histologicalGrade.routes";
import icdCodeRoutes from "./modules/icd-code/icdCode.routes";
import { hashPassword } from "./utils/bcrypt";

// Fix BigInt serialization - Prisma returns BigInt types that JSON.stringify can't handle
(BigInt.prototype as any).toJSON = function () {
    return this.toString();
};

const app = express();

app.use(cors());

app.use(express.json());

app.get("/api/health", (_req, res) => {
    res.json({ success: true, message: "Server is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/users", userRoutes);
app.use("/api/drugs", drugRoutes);
//app.use("/api/doctors", doctorRoutes);
app.use("/api/branch", branchRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/oncology/cancer-types", cancerTypeRoutes);
app.use("/api/oncology/cancer-stages", cancerStageRoutes);
app.use("/api/oncology/tnm-stages", tnmStageRoutes);
app.use("/api/oncology/histomorphologies", histomorphologyRoutes);
app.use("/api/oncology/histological-grades", histologicalGradeRoutes);
app.use("/api/oncology/icd-codes", icdCodeRoutes);
app.use("/api/hashpassword", async (req, res) => {

    const { password } = req.body;

    const hashedPassword = await hashPassword(password);

    res.json({ hashedPassword });

});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {

    console.log(`Server running on port ${PORT}`);

});