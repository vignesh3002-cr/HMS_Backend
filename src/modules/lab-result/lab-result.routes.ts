import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { LabResultController } from "./lab-result.controller";

const router = Router();
const controller = new LabResultController();

const optionalAuth = (req: Request, _res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(" ")[1] || (req as any).cookies?.token;
  if (token && process.env.JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      (req as any).user = decoded;
    } catch {}
  }
  next();
};

router.post("/batch", optionalAuth, controller.batchSave.bind(controller));
router.get("/order-item/:orderItemId", controller.getByOrderItemId.bind(controller));
router.get("/:id", controller.getById.bind(controller));
router.post("/", optionalAuth, controller.create.bind(controller));
router.put("/:id", optionalAuth, controller.update.bind(controller));
router.delete("/:id", optionalAuth, controller.delete.bind(controller));

export default router;

