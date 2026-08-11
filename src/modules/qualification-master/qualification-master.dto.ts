export interface CreateQualificationDto {
  qualification_name: string;
  designation: string;
  is_active?: boolean;
}

export interface UpdateQualificationDto {
  qualification_name?: string;
  designation?: string;
  is_active?: boolean;
}

export interface QualificationResponseDto {
  qualification_id: string;
  qualification_name: string;
  designation: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}