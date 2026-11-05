export interface CreateLabOrderDto {
    patient_history_id?: string;
    patient_id?: string;
    appointment_id?: string;
    doctor_employee_id: string;
    department_id?: string;
    priority?: string;
    clinical_notes?: string;
    provisional_diagnosis?: string;
    lab_description?: string;
    branch_id?: string;
    user_id?: string;
}

export interface UpdateLabOrderDto {
    priority?: string;
    clinical_notes?: string;
    provisional_diagnosis?: string;
    order_status?: string;
    // Non-lab / tissue investigations of the visit ("Other investigations: A, B").
    lab_description?: string;
}

// Filters on GET /lab-order: a patient's orders, one visit's order(s) by
// appointment, or the order(s) of one encounter (patient_history).
export interface LabOrderFilters {
    patientId?: string;
    appointmentId?: string;
    patientHistoryId?: string;
    limit?: number;
}