export interface PerformanceStatusMasterDTO {
    code: string;
    description: string;
    displayOrder?: number;
    isActive?: boolean;
    createdBy?: string;
}

export interface UpdatePerformanceStatusMasterDTO {
    description?: string;
    displayOrder?: number;
    isActive?: boolean;
    updatedBy?: string;
}

export interface SymptomMasterDTO {
    code: string;
    name: string;
    description?: string;
    category?: string;
    bodySystem?: string;
    isActive?: boolean;
    createdBy?: string;
}

export interface UpdateSymptomMasterDTO {
    name?: string;
    description?: string;
    category?: string;
    bodySystem?: string;
    isActive?: boolean;
    updatedBy?: string;
}

export interface AllergyMasterDTO {
    code: string;
    substanceName: string;
    substanceType: string;
    description?: string;
    severityLevel?: string;
    isActive?: boolean;
    createdBy?: string;
}

export interface UpdateAllergyMasterDTO {
    substanceName?: string;
    substanceType?: string;
    description?: string;
    severityLevel?: string;
    isActive?: boolean;
    updatedBy?: string;
}

export interface EncounterPerformanceStatusDTO {
    encounterNo: string;
    performanceStatusId: number;
    assessedBy?: string;
    clinicalNotes?: string;
}

export interface EncounterSymptomDTO {
    encounterNo: string;
    symptomId: number;
    severity?: string;
    durationDays?: number;
    onsetDate?: string;
    clinicalNotes?: string;
    recordedBy?: string;
}

export interface UpdateEncounterSymptomDTO {
    severity?: string;
    durationDays?: number;
    onsetDate?: string;
    clinicalNotes?: string;
    status?: string;
    updatedBy?: string;
}

export interface PatientAllergyDTO {
    patientId: string;
    allergyId: number;
    reaction?: string;
    severity?: string;
    status?: string;
    identifiedBy?: string;
    identifiedAtEncounterNo?: string;
    clinicalNotes?: string;
}

export interface UpdatePatientAllergyDTO {
    reaction?: string;
    severity?: string;
    status?: string;
    clinicalNotes?: string;
    updatedBy?: string;
}

export interface PatientComorbidityDTO {
    patientId: string;
    diagnosisId: string;
    status?: string;
    onsetDate?: string;
    identifiedBy?: string;
    identifiedAtEncounterNo?: string;
    clinicalNotes?: string;
}

export interface UpdatePatientComorbidityDTO {
    status?: string;
    onsetDate?: string;
    clinicalNotes?: string;
    updatedBy?: string;
}

export interface ClinicalDetailsQuery {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
}

export interface GetClinicalDetailsResponse {
    encounter: {
        encounterNo: string;
        patientId: string;
        encounterTs: Date;
        status: string;
    };
    performanceStatus: {
        id: bigint;
        code: string;
        description: string;
        assessedAt: Date;
        assessedBy: string | null;
        clinicalNotes: string | null;
    } | null;
    symptoms: Array<{
        id: bigint;
        symptomId: bigint;
        symptomCode: string;
        symptomName: string;
        severity: string | null;
        durationDays: number | null;
        onsetDate: Date | null;
        clinicalNotes: string | null;
        status: string;
        recordedAt: Date;
        recordedBy: string | null;
    }>;
    allergies: Array<{
        id: bigint;
        allergyId: bigint;
        allergyCode: string;
        substanceName: string;
        substanceType: string;
        reaction: string | null;
        severity: string | null;
        status: string;
        identifiedAt: Date;
        identifiedBy: string | null;
        identifiedAtEncounterNo: string | null;
        clinicalNotes: string | null;
    }>;
    comorbidities: Array<{
        id: bigint;
        diagnosisId: string;
        diagnosisName: string;
        icdCode: string | null;
        status: string;
        onsetDate: Date | null;
        identifiedAt: Date;
        identifiedBy: string | null;
        identifiedAtEncounterNo: string | null;
        clinicalNotes: string | null;
    }>;
}