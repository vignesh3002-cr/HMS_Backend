import { Router } from "express";
import { BranchController } from "./branch.controller";
import {
  createBranchValidation,
  updateBranchValidation,
  getAssignableAdminsValidation,
  assignAdminValidation,
} from "./branch.validation";
import { authenticate } from "../auth/auth.middleware";
import { authorize, authorizeRoles } from "../../middleware/authorize";
import { TOP_LEVEL_ADMIN_ROLES } from "../../permissions/roles";

const router = Router();

const controller = new BranchController();

// NEW: Get assignable admins - requires a top-level admin role
//
// This MUST be registered before `GET /:branchId` below — Express matches
// routes in registration order, and `/:branchId` is a catch-all single-segment
// param route. If it came first, `GET /branch/assignable-admins` would match
// `/:branchId` with branchId="assignable-admins" and 404 with "Branch not
// found" instead of ever reaching this handler (which is exactly what was
// happening before this reordering).
router.get(
  "/assignable-admins",
  authenticate,
  authorizeRoles(...TOP_LEVEL_ADMIN_ROLES),
  getAssignableAdminsValidation,
  controller.getAssignableAdmins.bind(controller)
);

// Existing routes
router.get("/", authenticate, controller.getAllBranches.bind(controller));
router.get("/:branchId", authenticate, controller.getBranchById.bind(controller));
router.post("/", authenticate, authorize("branch.create"), createBranchValidation, controller.createBranch.bind(controller));
router.put("/:branchId", authenticate, authorize("branch.update"), updateBranchValidation, controller.updateBranch.bind(controller));
router.delete("/:branchId", authenticate, authorize("branch.delete"), controller.deleteBranch.bind(controller));

// NEW: Assign/reassign admin to branch - requires a top-level admin role
router.patch(
  "/:branchId/admin",
  authenticate,
  authorizeRoles(...TOP_LEVEL_ADMIN_ROLES),
  assignAdminValidation,
  controller.assignAdmin.bind(controller)
);

// NEW: Explicitly unassign a Branch Admin (the "None" state) - requires a top-level admin role
router.patch(
  "/admin/:userId/unassign",
  authenticate,
  authorizeRoles(...TOP_LEVEL_ADMIN_ROLES),
  controller.unassignAdmin.bind(controller)
);

export default router;