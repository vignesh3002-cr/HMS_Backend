"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const branch_controller_1 = require("./branch.controller");
const branch_validation_1 = require("./branch.validation");
const auth_middleware_1 = require("../auth/auth.middleware");
const authorize_1 = require("../../middleware/authorize");
const roles_1 = require("../../permissions/roles");
const router = (0, express_1.Router)();
const controller = new branch_controller_1.BranchController();
// NEW: Get assignable admins - requires a top-level admin role
//
// This MUST be registered before `GET /:branchId` below — Express matches
// routes in registration order, and `/:branchId` is a catch-all single-segment
// param route. If it came first, `GET /branch/assignable-admins` would match
// `/:branchId` with branchId="assignable-admins" and 404 with "Branch not
// found" instead of ever reaching this handler (which is exactly what was
// happening before this reordering).
router.get("/assignable-admins", auth_middleware_1.authenticate, (0, authorize_1.authorize)(...roles_1.TOP_LEVEL_ADMIN_ROLES), branch_validation_1.getAssignableAdminsValidation, controller.getAssignableAdmins.bind(controller));
// Existing routes
router.get("/", auth_middleware_1.authenticate, controller.getAllBranches.bind(controller));
router.get("/:branchId", auth_middleware_1.authenticate, controller.getBranchById.bind(controller));
router.post("/", auth_middleware_1.authenticate, (0, authorize_1.authorize)(...roles_1.TOP_LEVEL_ADMIN_ROLES), branch_validation_1.createBranchValidation, controller.createBranch.bind(controller));
router.put("/:branchId", auth_middleware_1.authenticate, (0, authorize_1.authorize)(...roles_1.TOP_LEVEL_ADMIN_ROLES), branch_validation_1.updateBranchValidation, controller.updateBranch.bind(controller));
router.delete("/:branchId", auth_middleware_1.authenticate, (0, authorize_1.authorize)(...roles_1.TOP_LEVEL_ADMIN_ROLES), controller.deleteBranch.bind(controller));
// NEW: Assign/reassign admin to branch - requires a top-level admin role
router.patch("/:branchId/admin", auth_middleware_1.authenticate, (0, authorize_1.authorize)(...roles_1.TOP_LEVEL_ADMIN_ROLES), branch_validation_1.assignAdminValidation, controller.assignAdmin.bind(controller));
// NEW: Explicitly unassign a Branch Admin (the "None" state) - requires a top-level admin role
router.patch("/admin/:userId/unassign", auth_middleware_1.authenticate, (0, authorize_1.authorize)(...roles_1.TOP_LEVEL_ADMIN_ROLES), controller.unassignAdmin.bind(controller));
exports.default = router;
