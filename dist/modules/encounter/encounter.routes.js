"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const encounter_controller_1 = require("./encounter.controller");
const auth_middleware_1 = require("../auth/auth.middleware");
<<<<<<< HEAD
const authorize_1 = require("../../middleware/authorize");
=======
>>>>>>> a430ca9ba6608e611b8e0041162a90cf3433d7ed
const branchScope_1 = require("../../middleware/branchScope");
const encounter_validation_1 = require("./encounter.validation");
const router = (0, express_1.Router)();
const controller = new encounter_controller_1.EncounterController();
<<<<<<< HEAD
router.post("/", auth_middleware_1.authenticate, (0, authorize_1.authorize)("encounter.create"), encounter_validation_1.createEncounterValidation, controller.createEncounter.bind(controller));
router.get("/", auth_middleware_1.authenticate, (0, authorize_1.authorize)("encounter.read"), branchScope_1.branchScope, encounter_validation_1.getEncountersValidation, controller.getEncounters.bind(controller));
router.get("/:encounterNo", auth_middleware_1.authenticate, (0, authorize_1.authorize)("encounter.read"), controller.getEncounterByNumber.bind(controller));
router.put("/:encounterNo/close", auth_middleware_1.authenticate, (0, authorize_1.authorize)("encounter.update"), encounter_validation_1.closeEncounterValidation, controller.closeEncounter.bind(controller));
router.put("/:encounterNo", auth_middleware_1.authenticate, (0, authorize_1.authorize)("encounter.update"), encounter_validation_1.updateEncounterValidation, controller.updateEncounter.bind(controller));
=======
router.post("/", auth_middleware_1.authenticate, encounter_validation_1.createEncounterValidation, controller.createEncounter.bind(controller));
router.get("/", auth_middleware_1.authenticate, branchScope_1.branchScope, encounter_validation_1.getEncountersValidation, controller.getEncounters.bind(controller));
router.get("/:encounterNo", auth_middleware_1.authenticate, controller.getEncounterByNumber.bind(controller));
router.put("/:encounterNo/close", auth_middleware_1.authenticate, encounter_validation_1.closeEncounterValidation, controller.closeEncounter.bind(controller));
router.put("/:encounterNo", auth_middleware_1.authenticate, encounter_validation_1.updateEncounterValidation, controller.updateEncounter.bind(controller));
>>>>>>> a430ca9ba6608e611b8e0041162a90cf3433d7ed
exports.default = router;
