"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lab_order_repository_1 = __importDefault(require("./lab-order-repository"));
class LabOrderService {
    async create(data) {
        // Check Patient
        const patient = await lab_order_repository_1.default.findPatient(data.patient_history_id);
        if (!patient) {
            throw new Error("Patient History not found");
        }
        // Check Doctor
        const doctor = await lab_order_repository_1.default.findDoctor(data.doctor_employee_id);
        if (!doctor) {
            throw new Error("Doctor not found");
        }
        // Check Department
        if (data.department_id) {
            const department = await lab_order_repository_1.default.findDepartment(data.department_id);
            if (!department) {
                throw new Error("Department not found");
            }
        }
        // Check Appointment
        if (data.appointment_id) {
            const appointment = await lab_order_repository_1.default.findAppointment(data.appointment_id);
            if (!appointment) {
                throw new Error("Appointment not found");
            }
        }
        // Generate Lab Order ID
        const lab_order_id = `LAB${Date.now()}`;
        return lab_order_repository_1.default.create({
            ...data,
            lab_order_id
        });
    }
    async getAll() {
        return lab_order_repository_1.default.findAll();
    }
    async getById(id) {
        const order = await lab_order_repository_1.default.findById(id);
        if (!order) {
            throw new Error("Lab Order not found");
        }
        return order;
    }
    async update(id, data) {
        await this.getById(id);
        return lab_order_repository_1.default.update(id, data);
    }
    async delete(id) {
        await this.getById(id);
        return lab_order_repository_1.default.delete(id);
    }
}
exports.default = new LabOrderService();
