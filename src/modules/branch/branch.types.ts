// Mirrors the columns actually present on the `branch` table (see prisma/schema.prisma).
export interface CreateBranchDto {
  // Branch
  branch_code?: string;
  branch_name: string;
  branch_type: string;
  email?: string;
  emergency_number?: string;
  address?: string;
  district?: string;
  state_name?: string;
  country?: string;
  area?: string;
  pincode?: number;
  license_number?: string;
  total_beds?: number;
  total_no_emp?: string;
  fax_no?: string;
  medical_services?: string;
  gst_no?: string;
  pan_no?: string;
  website_address?: string;
  date_of_establish?: string;

  // Admin Mode: "EXISTING" | "NEW"
  admin_mode: "EXISTING" | "NEW";
  admin_user_id?: string;           // required when EXISTING
  admin?: NewBranchAdminDto;        // required when NEW
}

export interface NewBranchAdminDto {
  first_name: string;
  middle_name?: string;
  last_name?: string;
  email: string;
  mobile_no: string;
  username: string;
  password: string;
  designation?: string;             // defaults to "Branch Admin"
  department_id?: string;

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
  emergency_contact_name?: string;
  emergency_contact_relationship?: string;
  emergency_contact_number?: string;
  joining_date?: string;
}

export interface UpdateBranchDto {
  branch_code?: string;
  branch_name?: string;
  branch_type?: string;
  email?: string;
  emergency_number?: string;
  address?: string;
  district?: string;
  state_name?: string;
  country?: string;
  area?: string;
  pincode?: number;
  license_number?: string;
  total_beds?: number;
  total_no_emp?: string;
  fax_no?: string;
  medical_services?: string;
  gst_no?: string;
  pan_no?: string;
  website_address?: string;
  date_of_establish?: string;
  branch_status?: string;
}

export interface AssignableAdminDto {
  user_id: string;
  employee_id: string | null;
  full_name: string;
  email: string | null;
  role_type: string;
  current_branches: string[];
  current_branch_names: (string | null)[];
}