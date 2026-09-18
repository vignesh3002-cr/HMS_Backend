import { Router } from "express";
import { AIChatController } from "./ai-chat.controller";
import { authenticate } from "../auth/auth.middleware";

const router = Router();
const controller = new AIChatController();

router.post(
    "/",
    authenticate,
    controller.chat.bind(controller)
);

export default router;
