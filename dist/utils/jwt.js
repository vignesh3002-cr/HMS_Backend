"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = exports.generateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "1h");
const generateToken = (user, rememberMe = false) => {
    return jsonwebtoken_1.default.sign({
        id: user.user_id ?? user.id,
        user_id: user.user_id,
        employee_id: user.employee_id,
        username: user.username,
        role: user.role,
        hospital_id: user.hospital_id
    }, process.env.JWT_SECRET, {
        expiresIn: rememberMe
            ? "12h"
            : "12h"
    });
};
exports.generateToken = generateToken;
const verifyToken = (token) => {
    return jsonwebtoken_1.default.verify(token, JWT_SECRET);
};
exports.verifyToken = verifyToken;
