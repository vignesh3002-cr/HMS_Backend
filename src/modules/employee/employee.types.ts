export interface WorkingHourDto {
 
    branch_id: string;
 
    day_of_week:
        | "MONDAY"
        | "TUESDAY"
        | "WEDNESDAY"
        | "THURSDAY"
        | "FRIDAY"
        | "SATURDAY"
        | "SUNDAY";
 
    shift_name: string;
 
    start_time: string;
 
    end_time: string;
 
}
 
export interface CreateEmployeeDto {
 
    // Login
    username: string;
    password: string;
    role_type:
        | "DOCTOR"
        | "NURSE"
        | "LAB_TECHNICIAN"
        | "PHARMACIST"
        | "BRANCH_ADMIN"
        | "Admin";
 
    // Personal
 
    first_name: string;
    middle_name?: string;
    last_name: string;
    gender?:string;
    dob?: string;
    age?:number;
    email: string;
    mobile_no: string;

    blood_group?: string;
    nationality?: string;
    marital_status?: string;

    aadhaar_no?: string;
    pan_no?: string;
    passport_no?: string;
    permanent_employee_state?: string;
    permanent_employee_district?: string;
    permanent_employee_area? : string;
    permanent_address?: string;
    current_address?: string;
    employee_photo_URL?: string;
    employee_state?: string;
    employee_district?: string;
    employee_area?: string;
    employee_pincode?:number;
    employee_no_experence?: number;
 
    emergency_contact_name?: string;
    emergency_contact_relationship?: string;
    emergency_contact_number?: string;
 
    // Employment
 
    department_id: string;
    designation: string;
    joining_date: string;
    emp_status: boolean;
 
    // Doctor only
 
    specialization: string;
    qualification: string;
    license_no: string;
    consultation_minutes: number;
 
    // Multi Branch
 
    branch_ids: string[];
 
    // Doctor Schedule
    user_id:string;
    working_hours?: WorkingHourDto[];
}
 
export interface UpdateEmployeeDto {
 
    // Login — optional; only touched when the caller wants to change them
    username?: string;
    password?: string;
    gender?:string;
    dob?: string;
    age?:number;
    first_name?: string;
    middle_name?: string;
    last_name?: string;
 
    email?: string;
    mobile_no?: string;
 
    blood_group?: string;
    nationality?: string;
    marital_status?: string;
 
    aadhaar_no?: string;
    pan_no?: string;
    passport_no?: string;
 
    permanent_address?: string;
    current_address?: string;
    employee_photo_URL?: string;
    employee_state?: string;
    employee_district?: string;
    employee_area?: string;
    employee_pincode?: number;
    employee_no_experence?: number;
    permanent_employee_state?: string;
    permanent_employee_district?: string;
    permanent_employee_area? : string;

 
    emergency_contact_name?: string;
    emergency_contact_relationship?: string;
    emergency_contact_number?: string;
 
    department_id?: string;
    designation?: string;
    joining_date?: string;
    emp_status?: boolean;
 
    specialization?: string;
    qualification?: string;
    license_no?: string;
    role_type?:
        | "DOCTOR"
        | "NURSE"
        | "LAB_TECHNICIAN"
        | "PHARMACIST"
        | "BRANCH_ADMIN"
        | "Admin";
    consultation_minutes?: number;
    branch_ids?: string[];
    working_hours?: WorkingHourDto[];
}
 
export interface GetEmployeesQuery {
 
    roleType?: string;
 
    branchId?: string;
 
    department?: string;
 
    status?: boolean;
 
    search?: string;
 
    page?: number;
 
    limit?: number;
 
}