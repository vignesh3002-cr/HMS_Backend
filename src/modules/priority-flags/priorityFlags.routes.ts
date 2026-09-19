import { Router } from "express";
import { authenticate } from "../auth/auth.middleware";
import { PriorityFlagsController } from "./priorityFlags.controller";

const router = Router();
const controller = new PriorityFlagsController();

router.get("/", authenticate, controller.getPriorityFlags.bind(controller));

export default router;
