export interface CreateHospitalDto {
  hospital_name: string;
  hospital_address?: string | null;
  contact_number?: string | null;
  email_id?: string | null;
  website_address?: string | null;
  hospital_type?: string | null;
  hospital_license_no?: string | null;
  hospital_country?: string | null;
  hospital_state?: string | null;
  hospital_district?: string | null;
  hospital_area?: string | null;
  pincode?: string | null;
  timezone?: string | null;
}

export interface UpdateHospitalDto {
  hospital_name?: string;
  hospital_address?: string | null;
  contact_number?: string | null;
  email_id?: string | null;
  website_address?: string | null;
  hospital_type?: string | null;
  hospital_license_no?: string | null;
  hospital_country?: string | null;
  hospital_state?: string | null;
  hospital_district?: string | null;
  hospital_area?: string | null;
  pincode?: string | null;
  timezone?: string | null;
}

export interface HospitalRecord {
  hospital_id: string;
  hospital_name: string;
  Hospital_address: string | null;
  pincode: string | null;
  contact_number: string | null;
  fax_number: string | null;
  email_id: string | null;
  website_address: string | null;
  hospital_type: string | null;
  hospital_license_no: string | null;
  hospital_country: string | null;
  hospital_state: string | null;
  hospital_district: string | null;
  hospital_area: string | null;
  timezone: string | null;
  branch_count?: number;
}