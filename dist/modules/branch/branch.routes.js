"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const branch_controller_1 = require("./branch.controller");
const branch_validation_1 = require("./branch.validation");
const router = (0, express_1.Router)();
const controller = new branch_controller_1.BranchController();
// ✅ Add this ONE line for BranchSelector to work
router.get("/", controller.getAllBranches.bind(controller));
router.get("/:branchId", controller.getBranchById.bind(controller));
router.post("/", controller.createBranch.bind(controller));
router.put("/:branchId", branch_validation_1.updateBranchValidation, controller.updateBranch.bind(controller));
router.delete("/:branchId", controller.deleteBranch.bind(controller));
exports.default = router;
