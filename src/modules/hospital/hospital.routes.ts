import { Router } from "express";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../../middleware/authorize";
import {
  createHospitalValidation,
  updateHospitalValidation,
  getHospitalValidation,
  listHospitalsValidation,
} from "./hospital.validation";
import { HospitalController } from "./hospital.controller";

const router = Router();
const controller = new HospitalController();

// All hospital routes require authentication
router.use(authenticate);

// List hospitals (Super Admin and System Owner - both have all permissions)
router.get(
  "/",
  authorize("hospital.read"),
  listHospitalsValidation,
  controller.getAllHospitals.bind(controller)
);

// Create hospital (Super Admin and System Owner - both have all permissions)
router.post(
  "/",
  authorize("hospital.create"),
  createHospitalValidation,
  controller.createHospital.bind(controller)
);

// Get single hospital (Super Admin and System Owner - both have all permissions)
router.get(
  "/:hospitalId",
  authorize("hospital.read"),
  getHospitalValidation,
  controller.getHospital.bind(controller)
);

// Update hospital (Super Admin and System Owner - both have all permissions)
router.put(
  "/:hospitalId",
  authorize("hospital.update"),
  updateHospitalValidation,
  controller.updateHospital.bind(controller)
);

export default router;