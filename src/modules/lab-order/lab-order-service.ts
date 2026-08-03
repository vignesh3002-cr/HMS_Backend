import repository from "./lab-order-repository";

import {
    CreateLabOrderDto,
    UpdateLabOrderDto
} from "./lab-order-types";

class LabOrderService {

    async create(data: CreateLabOrderDto) {

        // Check Patient
        const patient = await repository.findPatient(
            data.patient_history_id
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

        return repository.create({
            ...data,
            lab_order_id
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