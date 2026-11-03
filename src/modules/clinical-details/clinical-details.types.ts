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
    durationDays?: number | null;
    durationUnit?: string | null;
    onsetDate?: string | null;
    clinicalNotes?: string | null;
    recordedBy?: string;
}

export interface UpdateEncounterSymptomDTO {
    severity?: string;
    durationDays?: number | null;
    durationUnit?: string | null;
    onsetDate?: string | null;
    clinicalNotes?: string | null;
    status?: string;
    updatedBy?: string;
}

export interface PatientAllergyDTO {
    patientId: string;
    allergyId: number;
    reaction?: string | null;
    severity?: string;
    durationValue?: number | null;
    durationUnit?: string | null;
    status?: string;
    identifiedBy?: string;
    identifiedAtEncounterNo?: string;
    clinicalNotes?: string | null;
}

export interface UpdatePatientAllergyDTO {
    reaction?: string | null;
    severity?: string;
    durationValue?: number | null;
    durationUnit?: string | null;
    status?: string;
    clinicalNotes?: string | null;
    updatedBy?: string;
}

export interface PatientComorbidityDTO {
    patientId: string;
    /* comorbidity_master.id */
    comorbidityId: number | string;
    status?: string;
    onsetDate?: string | null;
    durationValue?: number | null;
    durationUnit?: string | null;
    identifiedBy?: string;
    identifiedAtEncounterNo?: string;
    clinicalNotes?: string | null;
}

export interface UpdatePatientComorbidityDTO {
    status?: string;
    onsetDate?: string | null;
    durationValue?: number | null;
    durationUnit?: string | null;
    clinicalNotes?: string | null;
    updatedBy?: string;
}

export interface CreateCustomSymptomDTO {
    name: string;
}

export interface CreateCustomAllergyDTO {
    substanceName: string;
}

export interface CreateCustomComorbidityDTO {
    comorbidityName: string;
    category?: string;
    icdCode?: string;
    createdBy?: string;
}

export interface ComorbidityMasterQuery {
    search?: string;
    category?: string;
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
        durationUnit: string | null;
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
        durationValue: number | null;
        durationUnit: string | null;
        status: string;
        identifiedAt: Date;
        identifiedBy: string | null;
        identifiedAtEncounterNo: string | null;
        clinicalNotes: string | null;
    }>;
    comorbidities: Array<{
        id: bigint;
        comorbidityId: bigint;
        comorbidityCode: string;
        comorbidityName: string;
        category: string | null;
        icdCode: string | null;
        status: string;
        onsetDate: Date | null;
        durationValue: number | null;
        durationUnit: string | null;
        identifiedAt: Date;
        identifiedBy: string | null;
        identifiedAtEncounterNo: string | null;
        clinicalNotes: string | null;
    }>;
}