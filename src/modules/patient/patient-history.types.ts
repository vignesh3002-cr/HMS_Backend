export interface CreatePatientHistoryDTO {
  patientId: string;
  appointmentId?: string;
  systolicBp?: number;
  diastolicBp?: number;
  pulse?: number;
  respiratoryRate?: number;
  temperature?: number;
  oxygenSaturation?: number;
  bloodSugar?: string;
  weight?: number;
  height?: number;
  painScore?: number;
  severity?: number;
  clinicalNotes?: string;
  branchId?: string;
  departmentId?: string;
  employeeId?: string;
}