"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("../../config/prisma"));
const lab_order_repository_1 = __importDefault(require("./lab-order-repository"));
const idGenerator_1 = require("../../utils/idGenerator");
class LabOrderService {
    async create(data) {
        // Resolve patient history: accept patient_history_id directly or
        // resolve it from the patient's most recent visit (patient_id).
        let patient_history_id = data.patient_history_id;
        if (!patient_history_id && data.patient_id) {
            const history = await lab_order_repository_1.default.findMostRecentPatientHistory(data.patient_id);
            if (history) {
                patient_history_id = history.patient_history_id;
            }
            else {
                // New walk-in patient with no recorded visit yet.
                // Auto-create an IN_PROGRESS patient_history for this visit
                // (same pattern as prescription.service.ts) so the doctor
                // can order lab tests without a prior visit record.
                const patient = await prisma_1.default.patient_bio_data.findUnique({
                    where: { patient_id: data.patient_id }
                });
                if (!patient) {
                    throw new Error("Patient not found");
                }
                patient_history_id = await prisma_1.default.$transaction(async (tx) => {
                    const newId = await (0, idGenerator_1.generateId)(tx, "PATIENT_HISTORY");
                    const created = await tx.patient_history.create({
                        data: {
                            patient_history_id: newId,
                            patient_id: data.patient_id,
                            visit_type: "Consultation",
                            visit_date: new Date(),
                            visit_status: "IN_PROGRESS",
                            employee_id: data.doctor_employee_id,
                            ...(data.branch_id ? { branch_id: data.branch_id } : {}),
                            ...(data.department_id ? { department_id: data.department_id } : {}),
                            ...(data.appointment_id ? { appointment_id: data.appointment_id } : {})
                        }
                    });
                    return created.patient_history_id;
                });
            }
        }
        if (!patient_history_id) {
            throw new Error("Patient History ID is required");
        }
        // Check Patient History exists
        const patient = await lab_order_repository_1.default.findPatient(patient_history_id);
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
        // Explicit payload — lab_order has NO patient_id column, only
        // patient_history_id (resolved above), so it must never be spread.
        return lab_order_repository_1.default.create({
            patient_history_id,
            doctor_employee_id: data.doctor_employee_id,
            lab_order_id,
            ...(data.appointment_id ? { appointment_id: data.appointment_id } : {}),
            ...(data.department_id ? { department_id: data.department_id } : {}),
            ...(data.priority ? { priority: data.priority } : {}),
            ...(data.clinical_notes !== undefined ? { clinical_notes: data.clinical_notes } : {}),
            ...(data.provisional_diagnosis !== undefined ? { provisional_diagnosis: data.provisional_diagnosis } : {}),
            ...(data.lab_description !== undefined ? { lab_description: data.lab_description } : {}),
            ...(data.branch_id ? { branch_id: data.branch_id } : {}),
            ...(data.user_id ? { user_id: data.user_id } : {})
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
