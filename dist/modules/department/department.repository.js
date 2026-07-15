"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DepartmentRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
class DepartmentRepository {
    async getAllDepartments() {
        return await prisma_1.default.department_master.findMany({
            orderBy: {
                department_name: "asc"
            }
        });
    }
}
exports.DepartmentRepository = DepartmentRepository;
