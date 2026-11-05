import { Router } from "express";
import { FollowupController } from "./followup.controller";
import { authenticate } from "../auth/auth.middleware";

const router = Router();
const controller = new FollowupController();

// Follow-up due alerts of the signed-in user's branches (all branches for
// Head / Super Admin). The role and branches come from the login.
router.get("/alerts", authenticate, controller.listAlerts.bind(controller));
router.put("/alerts/read", authenticate, controller.markRead.bind(controller));
router.put("/alerts/:encounterNo/dismiss", authenticate, controller.dismiss.bind(controller));

export default router;
