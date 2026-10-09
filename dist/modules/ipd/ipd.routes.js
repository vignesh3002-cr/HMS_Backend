"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ipd_controller_1 = require("./ipd.controller");
const auth_middleware_1 = require("../auth/auth.middleware");
const authorize_1 = require("../../middleware/authorize");
const branchScope_1 = require("../../middleware/branchScope");
const ipd_validation_1 = require("./ipd.validation");
const router = (0, express_1.Router)();
const controller = new ipd_controller_1.IpdController();
router.post("/", auth_middleware_1.authenticate, (0, authorize_1.authorize)("admission.create"), ipd_validation_1.createAdmissionValidation, controller.createAdmission.bind(controller));
router.get("/", auth_middleware_1.authenticate, (0, authorize_1.authorize)("admission.read"), branchScope_1.branchScope, ipd_validation_1.getAdmissionsValidation, controller.listAdmissions.bind(controller));
router.get("/stats/patients-today", auth_middleware_1.authenticate, (0, authorize_1.authorize)("admission.read"), branchScope_1.branchScope, controller.getAdmittedPatientsToday.bind(controller));
router.get("/stats/overview", auth_middleware_1.authenticate, (0, authorize_1.authorize)("admission.read"), branchScope_1.branchScope, controller.getIpdOverview.bind(controller));
// Daycare booking (doctor slot + planned daycare admission) and the ward
// capacity view the booking form uses to hide full slots.
router.post("/daycare", auth_middleware_1.authenticate, (0, authorize_1.authorize)("admission.create"), ipd_validation_1.createDaycareValidation, controller.bookDaycare.bind(controller));
router.get("/daycare/occupancy", auth_middleware_1.authenticate, (0, authorize_1.authorize)("admission.read"), ipd_validation_1.daycareOccupancyValidation, controller.getDaycareOccupancy.bind(controller));
router.get("/wards", auth_middleware_1.authenticate, (0, authorize_1.authorize)("admission.read"), branchScope_1.branchScope, controller.listWards.bind(controller));
router.post("/wards", auth_middleware_1.authenticate, (0, authorize_1.authorizeAny)("ward.manage", "admission.create"), branchScope_1.branchScope, ipd_validation_1.createWardValidation, controller.createWard.bind(controller));
router.patch("/wards/:wardId", auth_middleware_1.authenticate, (0, authorize_1.authorizeAny)("ward.manage", "admission.create"), branchScope_1.branchScope, ipd_validation_1.updateWardValidation, controller.updateWard.bind(controller));
router.delete("/wards/:wardId", auth_middleware_1.authenticate, (0, authorize_1.authorizeAny)("ward.manage", "admission.create"), branchScope_1.branchScope, controller.deleteWard.bind(controller));
router.get("/beds", auth_middleware_1.authenticate, (0, authorize_1.authorize)("admission.read"), branchScope_1.branchScope, controller.listBeds.bind(controller));
router.post("/beds", auth_middleware_1.authenticate, (0, authorize_1.authorizeAny)("bed.manage", "admission.create"), branchScope_1.branchScope, ipd_validation_1.createBedValidation, controller.createBed.bind(controller));
router.patch("/beds/:bedId", auth_middleware_1.authenticate, (0, authorize_1.authorizeAny)("bed.manage", "admission.create"), branchScope_1.branchScope, ipd_validation_1.updateBedValidation, controller.updateBed.bind(controller));
router.delete("/beds/:bedId", auth_middleware_1.authenticate, (0, authorize_1.authorizeAny)("bed.manage", "admission.create"), branchScope_1.branchScope, controller.deleteBed.bind(controller));
router.patch("/beds/:id/status", auth_middleware_1.authenticate, (0, authorize_1.authorizeAny)("bed.manage", "admission.create"), branchScope_1.branchScope, ipd_validation_1.updateBedStatusValidation, controller.updateBedStatus.bind(controller));
router.get("/:ipNumber", auth_middleware_1.authenticate, (0, authorize_1.authorize)("admission.read"), ipd_validation_1.getAdmissionByIpNumberValidation, controller.getAdmissionByIpNumber.bind(controller));
router.patch("/:id", auth_middleware_1.authenticate, (0, authorize_1.authorize)("admission.update"), ipd_validation_1.updateAdmissionValidation, controller.updateAdmission.bind(controller));
// Status transitions have dedicated endpoints -- PATCH /:id only edits details.
router.post("/:id/admit", auth_middleware_1.authenticate, (0, authorize_1.authorize)("admission.update"), ipd_validation_1.admitAdmissionValidation, controller.admitAdmission.bind(controller));
router.post("/:id/cancel", auth_middleware_1.authenticate, (0, authorize_1.authorize)("admission.update"), ipd_validation_1.closePlannedValidation, controller.cancelAdmission.bind(controller));
router.post("/:id/no-show", auth_middleware_1.authenticate, (0, authorize_1.authorize)("admission.update"), ipd_validation_1.closePlannedValidation, controller.markNoShow.bind(controller));
router.post("/:id/reserve", auth_middleware_1.authenticate, (0, authorize_1.authorize)("admission.update"), ipd_validation_1.reserveBedValidation, controller.reserveBed.bind(controller));
router.post("/:id/release-reservation", auth_middleware_1.authenticate, (0, authorize_1.authorize)("admission.update"), controller.releaseReservation.bind(controller));
router.post("/:id/discharge", auth_middleware_1.authenticate, (0, authorize_1.authorize)("admission.discharge"), ipd_validation_1.dischargeAdmissionValidation, controller.dischargeAdmission.bind(controller));
router.post("/:id/transfer", auth_middleware_1.authenticate, (0, authorize_1.authorize)("admission.transfer"), ipd_validation_1.transferAdmissionValidation, controller.transferAdmission.bind(controller));
exports.default = router;
