"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDoctorByEmployeeId = exports.getDoctors = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const getDoctors = async () => {
    return prisma_1.default.employees.findMany({
        where: {
            user_table: {
                role_type: "DOCTOR"
            }
        },
        include: {
            user_table: true,
            doctor_profile: true,
            doctor_schedule: true,
            branch: true
        },
        orderBy: {
            first_name: "asc"
        }
    });
};
exports.getDoctors = getDoctors;
const getDoctorByEmployeeId = async (employeeId) => {
    return prisma_1.default.employees.findUnique({
        where: {
            employee_id: employeeId
        },
        include: {
            user_table: true,
            doctor_profile: true,
            branch: true,
            doctor_schedule: true,
            user_branch_mapping: {
                include: {
                    branch: true
                }
            }
        }
    });
};
exports.getDoctorByEmployeeId = getDoctorByEmployeeId;
