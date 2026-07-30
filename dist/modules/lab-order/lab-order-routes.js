"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const lab_order_controller_1 = __importDefault(require("./lab-order-controller"));
const lab_order_validation_1 = require("./lab-order-validation");
const router = (0, express_1.Router)();
router.post("/", lab_order_validation_1.createLabOrderValidation, lab_order_controller_1.default.create);
router.get("/", lab_order_controller_1.default.getAll);
router.get("/:id", lab_order_controller_1.default.getById);
router.put("/:id", lab_order_validation_1.updateLabOrderValidation, lab_order_controller_1.default.update);
router.delete("/:id", lab_order_controller_1.default.delete);
exports.default = router;
