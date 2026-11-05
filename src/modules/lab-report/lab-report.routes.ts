import { Router } from "express";
import { LabReportController } from "./lab-report.controller";
import { authenticate } from "../auth/auth.middleware";

const router = Router();
const controller = new LabReportController();

// Every lab report route needs a logged-in user.
router.use(authenticate);

router.get("/", (req, res) => controller.getAll(req, res));
router.post("/", (req, res) => controller.create(req, res));
router.get("/order/:orderId", (req, res) => controller.getByOrderId(req, res));
router.get("/:id", (req, res) => controller.getById(req, res));
router.put("/:id/transfer", (req, res) => controller.transfer(req, res));
router.put("/:id", (req, res) => controller.update(req, res));
router.delete("/:id", (req, res) => controller.delete(req, res));

export default router;
