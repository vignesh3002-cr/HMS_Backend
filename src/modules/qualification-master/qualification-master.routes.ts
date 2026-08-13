import { Router } from "express";
import { qualificationMasterController } from "./qualification-master.controller";
import {
  createQualificationValidation,
  updateQualificationValidation,
} from "./qualification-master.validation";
import { authenticate } from "../auth/auth.middleware";

const router = Router();

// Create Qualification
// Create Qualification
router.post(
  "/",
  authenticate,
  createQualificationValidation,
  qualificationMasterController.create.bind(qualificationMasterController)
);

// Get All Qualifications
router.get(
  "/",
  authenticate,
  qualificationMasterController.getAll.bind(qualificationMasterController)
);

// Get By Designation  <-- Move this here
router.get(
  "/by-designation/:designation",
  authenticate,
  qualificationMasterController.getByDesignation.bind(
    qualificationMasterController
  )
);

// Get Qualification By ID
router.get(
  "/:id",
  authenticate,
  qualificationMasterController.getById.bind(qualificationMasterController)
);

// Update Qualification
router.put(
  "/:id",
  authenticate,
  updateQualificationValidation,
  qualificationMasterController.update.bind(qualificationMasterController)
);

// Delete Qualification
router.delete(
  "/:id",
  authenticate,
  qualificationMasterController.delete.bind(qualificationMasterController)
);

export default router;