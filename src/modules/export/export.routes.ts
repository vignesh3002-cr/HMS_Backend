import { Router } from "express";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../../middleware/authorize";
import { branchScope } from "../../middleware/branchScope";
import { exportEmployees, exportPatients, exportAppointments } from "./export.controller";

const router = Router();

router.get(
    "/employees",
    authenticate,
    authorize("employee.read"),
    authorize("report.export"),
    branchScope,
    exportEmployees
);

router.get(
    "/patients",
    authenticate,
    authorize("patient.read"),
    authorize("report.export"),
    branchScope,
    exportPatients
);

router.get(
    "/appointments",
    authenticate,
    authorize("appointment.read"),
    authorize("report.export"),
    branchScope,
    exportAppointments
);

export default router;
