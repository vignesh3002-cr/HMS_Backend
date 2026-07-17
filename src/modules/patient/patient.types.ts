export interface CreatePatientRequest {

    // Login Information
    username: string;
    password: string;

    // Basic Details
    first_name: string;
    middle_name?: string;
    last_name?: string;

    gender?: string;
    dob?: Date;
    age?: number;

    blood_group?: string;

    mobile: string;
    alternate_mobile?: string;

    email?: string;

    marital_status?: string;
    nationality?: string;
    language?: string;

    patient_type?: string;
    visit_type?: string;

    referred_by?: string;

    // Address
    permanent_address?: string;
    current_address?: string;

    area?: string;
    city?: string;
    district?: string;
    state?: string;
    country?: string;
    pincode?: string;

    // Emergency Contact
    emergency_contact_name?: string;
    relationship?: string;
    emergency_mobile?: string;
    emergency_address?: string;

    // Guardian
    guardian_name?: string;
    guardian_relation?: string;
    guardian_mobile?: string;

    // Identification
    aadhaar_no?: string;
    passport_no?: string;

    // Insurance
    insurance_available?: boolean;
    insurance_company?: string;
    insurance_policy_no?: string;
    policy_holder_name?: string;
    insurance_valid_from?: Date;
    insurance_valid_to?: Date;

    // Medical
    allergies?: string;
    chronic_disease?: string;
    current_medication?: string;
    medical_history?: string;
    surgical_history?: string;
    family_history?: string;

    smoking?: boolean;
    alcohol?: boolean;

    photo?: string;

    branch_id: string;

    created_by: string;
}