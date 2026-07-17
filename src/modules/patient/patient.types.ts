export interface CreatePatientRequest {

    // Login Information
    username: string;
    password: string;

    // Basic Details
    first_name: string;
    middle_name?: string;
    last_name?: string;

    gender?: string;
    dob?: string;
    age?: number;

    blood_group?: string;

    mobile: string;
    alternate_mobile?: string;

    email?: string;

    marital_status?: string;
    nationality?: string;

    patient_type?: string;

    photo?: string;

    branch_id: string;

    created_by: string;
}

export interface UpdatePatientRequest {

    first_name?: string;
    middle_name?: string;
    last_name?: string;

    gender?: string;
    dob?: string;
    age?: number;

    blood_group?: string;

    mobile?: string;
    alternate_mobile?: string;

    email?: string;

    marital_status?: string;
    nationality?: string;

    patient_type?: string;
    patient_active?: string;

    photo?: string;

    branch_id?: string;
}

export interface GetPatientsQuery {

    branchId?: string;
    patientType?: string;
    status?: string;
    search?: string;

    page?: number;
    limit?: number;
}
