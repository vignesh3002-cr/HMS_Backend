"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../auth/auth.middleware");
const authorize_1 = require("../../middleware/authorize");
const hospital_validation_1 = require("./hospital.validation");
const hospital_controller_1 = require("./hospital.controller");
const router = (0, express_1.Router)();
const controller = new hospital_controller_1.HospitalController();
// All hospital routes require authentication
router.use(auth_middleware_1.authenticate);
// List hospitals (Super Admin and System Owner - both have all permissions)
router.get("/", (0, authorize_1.authorize)("hospital.read"), hospital_validation_1.listHospitalsValidation, controller.getAllHospitals.bind(controller));
// Create hospital (Super Admin and System Owner - both have all permissions)
router.post("/", (0, authorize_1.authorize)("hospital.create"), hospital_validation_1.createHospitalValidation, controller.createHospital.bind(controller));
// Get single hospital (Super Admin and System Owner - both have all permissions)
router.get("/:hospitalId", (0, authorize_1.authorize)("hospital.read"), hospital_validation_1.getHospitalValidation, controller.getHospital.bind(controller));
// Update hospital (Super Admin and System Owner - both have all permissions)
router.put("/:hospitalId", (0, authorize_1.authorize)("hospital.update"), hospital_validation_1.updateHospitalValidation, controller.updateHospital.bind(controller));
exports.default = router;
