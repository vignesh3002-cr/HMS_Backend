export interface CreateLabOrderDto {
    patient_history_id: string;
    appointment_id?: string;
    doctor_employee_id: string;
    department_id?: string;
    priority?: string;
    clinical_notes?: string;
    provisional_diagnosis?: string;
}

export interface UpdateLabOrderDto {
    priority?: string;
    clinical_notes?: string;
    provisional_diagnosis?: string;
    order_status?: string;
}