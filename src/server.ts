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
import { hashPassword } from "./utils/bcrypt";
dns.setDefaultResultOrder("ipv4first");
// Fix BigInt serialization - Prisma returns BigInt types that JSON.stringify can't handle
(BigInt.prototype as any).toJSON = function () {
    return this.toString();
};

const app = express();

const allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    process.env.FRONTEND_URL,
].filter(Boolean) as string[];
 
const isAllowedOrigin = (origin: string | undefined) => {
    if (!origin) return true;
 
    if (allowedOrigins.includes(origin)) return true;
 
    return /^https:\/\/.*\.vercel\.app$/i.test(origin);
};
 
app.use(
    cors({
        origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
            if (isAllowedOrigin(origin)) {
                callback(null, true);
                return;
            }
 
            callback(new Error(`Not allowed by CORS: ${origin}`));
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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
app.use("/api/appointments", appointmentRoutes);

app.use("/api/hashpassword", async (req, res) => {

    const { password } = req.body;

    const hashedPassword = await hashPassword(password);

    res.json({ hashedPassword });

});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {

    console.log(`Server running on port ${PORT}`);

});