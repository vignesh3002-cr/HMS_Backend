"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const qualification_master_controller_1 = require("./qualification-master.controller");
const qualification_master_validation_1 = require("./qualification-master.validation");
const auth_middleware_1 = require("../auth/auth.middleware");
const router = (0, express_1.Router)();
// Create Qualification
// Create Qualification
router.post("/", auth_middleware_1.authenticate, qualification_master_validation_1.createQualificationValidation, qualification_master_controller_1.qualificationMasterController.create.bind(qualification_master_controller_1.qualificationMasterController));
// Get All Qualifications
router.get("/", auth_middleware_1.authenticate, qualification_master_controller_1.qualificationMasterController.getAll.bind(qualification_master_controller_1.qualificationMasterController));
// Get By Designation  <-- Move this here
router.get("/by-designation/:designation", auth_middleware_1.authenticate, qualification_master_controller_1.qualificationMasterController.getByDesignation.bind(qualification_master_controller_1.qualificationMasterController));
// Get Qualification By ID
router.get("/:id", auth_middleware_1.authenticate, qualification_master_controller_1.qualificationMasterController.getById.bind(qualification_master_controller_1.qualificationMasterController));
// Update Qualification
router.put("/:id", auth_middleware_1.authenticate, qualification_master_validation_1.updateQualificationValidation, qualification_master_controller_1.qualificationMasterController.update.bind(qualification_master_controller_1.qualificationMasterController));
// Delete Qualification
router.delete("/:id", auth_middleware_1.authenticate, qualification_master_controller_1.qualificationMasterController.delete.bind(qualification_master_controller_1.qualificationMasterController));
exports.default = router;
