"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const lab_test_category_controller_1 = __importDefault(require("./lab-test-category.controller"));
const auth_middleware_1 = require("../auth/auth.middleware");
const authorize_1 = require("../../middleware/authorize");
const lab_test_category_validation_1 = require("./lab-test-category.validation");
const router = (0, express_1.Router)();
router.post("/", auth_middleware_1.authenticate, (0, authorize_1.authorize)("lab.manage"), lab_test_category_validation_1.createLabTestCategoryValidation, lab_test_category_controller_1.default.create);
router.get("/", auth_middleware_1.authenticate, (0, authorize_1.authorize)("lab.manage"), lab_test_category_controller_1.default.getAll);
router.get("/:id", auth_middleware_1.authenticate, (0, authorize_1.authorize)("lab.manage"), lab_test_category_controller_1.default.getById);
router.put("/:id", auth_middleware_1.authenticate, (0, authorize_1.authorize)("lab.manage"), lab_test_category_validation_1.updateLabTestCategoryValidation, lab_test_category_controller_1.default.update);
router.delete("/:id", auth_middleware_1.authenticate, (0, authorize_1.authorize)("lab.manage"), lab_test_category_controller_1.default.delete);
exports.default = router;
