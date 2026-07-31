"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const lab_test_master_controller_1 = __importDefault(require("./lab-test-master.controller"));
const lab_test_master_validation_1 = require("./lab-test-master.validation");
const router = (0, express_1.Router)();
router.post("/", lab_test_master_validation_1.createLabTestMasterValidation, lab_test_master_controller_1.default.create);
router.get("/", lab_test_master_controller_1.default.getAll);
router.get("/:id", lab_test_master_controller_1.default.getById);
router.put("/:id", lab_test_master_validation_1.updateLabTestMasterValidation, lab_test_master_controller_1.default.update);
router.delete("/:id", lab_test_master_controller_1.default.delete);
exports.default = router;
