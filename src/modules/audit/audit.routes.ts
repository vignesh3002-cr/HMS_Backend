import { Router } from "express";
import { AuditController } from "./audit.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../../middleware/authorize";
import { listAuditLogsValidation } from "./audit.validation";

const router = Router();
const controller = new AuditController();

router.get(
    "/logs",
    authenticate,
    authorize("audit.read"),
    listAuditLogsValidation,
    controller.listAuditLogs.bind(controller)
);

export default router;
