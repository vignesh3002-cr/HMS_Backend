"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const branch_controller_1 = require("./branch.controller");
const router = (0, express_1.Router)();
const controller = new branch_controller_1.BranchController();
// ✅ Add this ONE line for BranchSelector to work
router.get("/", controller.getAllBranches.bind(controller));
router.post("/", controller.createBranch.bind(controller));
exports.default = router;
