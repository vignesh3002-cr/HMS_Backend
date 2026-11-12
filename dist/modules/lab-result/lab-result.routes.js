"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const lab_result_controller_1 = require("./lab-result.controller");
const router = (0, express_1.Router)();
const controller = new lab_result_controller_1.LabResultController();
const optionalAuth = (req, _res, next) => {
    const token = req.headers.authorization?.split(" ")[1] || req.cookies?.token;
    if (token && process.env.JWT_SECRET) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
        }
        catch { }
    }
    next();
};
router.post("/batch", optionalAuth, controller.batchSave.bind(controller));
router.get("/order-item/:orderItemId", controller.getByOrderItemId.bind(controller));
router.get("/:id", controller.getById.bind(controller));
router.post("/", optionalAuth, controller.create.bind(controller));
router.put("/:id", optionalAuth, controller.update.bind(controller));
router.delete("/:id", optionalAuth, controller.delete.bind(controller));
exports.default = router;
