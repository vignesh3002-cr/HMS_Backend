"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("../../config/prisma"));
class LabOrderRepository {
    async create(data) {
        return prisma_1.default.lab_order.create({
            data
        });
    }
    async findById(lab_order_id) {
        return prisma_1.default.lab_order.findUnique({
            where: {
                lab_order_id
            },
            include: {
                patient_history: true,
                employees: true,
                department_master: true,
                appointment_history: true,
                lab_order_item: {
                    include: {
                        lab_test_master: true
                    }
                },
                lab_report: true
            }
        });
    }
    async findAll() {
        return prisma_1.default.lab_order.findMany({
            select: {
                lab_order_id: true,
                patient_history_id: true,
                appointment_id: true,
                doctor_employee_id: true,
                department_id: true,
                order_datetime: true,
                priority: true,
                order_status: true,
                patient_history: {
                    select: {
                        patient_history_id: true,
                        patient_id: true,
                        visit_type: true,
                        visit_status: true
                    }
                },
                employees: {
                    select: {
                        employee_id: true,
                        first_name: true,
                        last_name: true,
                        designation: true
                    }
                },
                department_master: {
                    select: {
                        department_id: true,
                        department_name: true
                    }
                }
            },
            orderBy: {
                created_at: "desc"
            }
        });
    }
    async findPatient(patient_history_id) {
        return prisma_1.default.patient_history.findUnique({
            where: {
                patient_history_id
            }
        });
    }
    async findMostRecentPatientHistory(patient_id) {
        return prisma_1.default.patient_history.findFirst({
            where: { patient_id },
            orderBy: { id: "desc" }
        });
    }
    async findDoctor(employee_id) {
        return prisma_1.default.employees.findUnique({
            where: {
                employee_id
            }
        });
    }
    async findDepartment(department_id) {
        return prisma_1.default.department_master.findUnique({
            where: {
                department_id
            }
        });
    }
    async findAppointment(appointment_id) {
        return prisma_1.default.appointment_history.findUnique({
            where: {
                appointment_id
            }
        });
    }
    async update(lab_order_id, data) {
        return prisma_1.default.lab_order.update({
            where: {
                lab_order_id
            },
            data
        });
    }
    async delete(lab_order_id) {
        return prisma_1.default.lab_order.delete({
            where: {
                lab_order_id
            }
        });
    }
}
exports.default = new LabOrderRepository();
