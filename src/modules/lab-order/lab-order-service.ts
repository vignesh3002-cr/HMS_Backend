import prisma from "../../config/prisma";
import repository from "./lab-order-repository";
import { generateId } from "../../utils/idGenerator";

import {
    CreateLabOrderDto,
    UpdateLabOrderDto
} from "./lab-order-types";

class LabOrderService {

    async create(data: CreateLabOrderDto) {

        // Resolve patient history: accept patient_history_id directly or
        // resolve it from the patient's most recent visit (patient_id).
        let patient_history_id = data.patient_history_id;

        if (!patient_history_id && data.patient_id) {

            const history = await repository.findMostRecentPatientHistory(
                data.patient_id
            );

            if (history) {

                patient_history_id = history.patient_history_id;

            } else {

                // New walk-in patient with no recorded visit yet.
                // Auto-create an IN_PROGRESS patient_history for this visit
                // (same pattern as prescription.service.ts) so the doctor
                // can order lab tests without a prior visit record.

                const patient = await prisma.patient_bio_data.findUnique({
                    where: { patient_id: data.patient_id }
                });

                if (!patient) {
                    throw new Error("Patient not found");
                }

                patient_history_id = await prisma.$transaction(async (tx) => {

                    const newId = await generateId(tx, "PATIENT_HISTORY");

                    const created = await tx.patient_history.create({
                        data: {
                            patient_history_id: newId,
                            patient_id: data.patient_id!,
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
        const patient = await repository.findPatient(
            patient_history_id
        );

        if (!patient) {
            throw new Error("Patient History not found");
        }

        // Check Doctor
        const doctor = await repository.findDoctor(
            data.doctor_employee_id
        );

        if (!doctor) {
            throw new Error("Doctor not found");
        }

        // Check Department
        if (data.department_id) {

            const department = await repository.findDepartment(
                data.department_id
            );

            if (!department) {
                throw new Error("Department not found");
            }

        }

        // Check Appointment
        if (data.appointment_id) {

            const appointment = await repository.findAppointment(
                data.appointment_id
            );

            if (!appointment) {
                throw new Error("Appointment not found");
            }

        }

        // Generate Lab Order ID
        const lab_order_id = `LAB${Date.now()}`;

        // Explicit payload — lab_order has NO patient_id column, only
        // patient_history_id (resolved above), so it must never be spread.
        return repository.create({
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

        return repository.findAll();

    }

    async getById(id: string) {

        const order = await repository.findById(id);

        if (!order) {
            throw new Error("Lab Order not found");
        }

        return order;

    }

    async update(
        id: string,
        data: UpdateLabOrderDto
    ) {

        await this.getById(id);

        return repository.update(id, data);

    }

    async delete(id: string) {

        await this.getById(id);

        return repository.delete(id);

    }

}

export default new LabOrderService();