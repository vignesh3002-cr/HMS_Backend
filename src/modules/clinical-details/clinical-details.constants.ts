export const PERFORMANCE_STATUS_CODES = {
    ECOG_0: 'ECOG_0',
    ECOG_1: 'ECOG_1',
    ECOG_2: 'ECOG_2',
    ECOG_3: 'ECOG_3',
    ECOG_4: 'ECOG_4',
    ECOG_5: 'ECOG_5',
} as const;

export const PERFORMANCE_STATUS_DEFAULT_CODE = PERFORMANCE_STATUS_CODES.ECOG_0;

export const SYMPTOM_CATEGORIES = {
    GENERAL: 'GENERAL',
    RESPIRATORY: 'RESPIRATORY',
    CARDIOVASCULAR: 'CARDIOVASCULAR',
    GASTROINTESTINAL: 'GASTROINTESTINAL',
    NEUROLOGICAL: 'NEUROLOGICAL',
    DERMATOLOGICAL: 'DERMATOLOGICAL',
    MUSCULOSKELETAL: 'MUSCULOSKELETAL',
    PSYCHIATRIC: 'PSYCHIATRIC',
    ONCOLOGY: 'ONCOLOGY',
    OTHER: 'OTHER',
} as const;

export const SYMPTOM_SEVERITY = {
    MILD: 'MILD',
    MODERATE: 'MODERATE',
    SEVERE: 'SEVERE',
    CRITICAL: 'CRITICAL',
} as const;

export const ALLERGY_TYPES = {
    DRUG: 'DRUG',
    FOOD: 'FOOD',
    ENVIRONMENTAL: 'ENVIRONMENTAL',
    LATEX: 'LATEX',
    OTHER: 'OTHER',
} as const;

export const ALLERGY_SEVERITY = {
    MILD: 'MILD',
    MODERATE: 'MODERATE',
    SEVERE: 'SEVERE',
    ANAPHYLACTIC: 'ANAPHYLACTIC',
} as const;

export const ALLERGY_STATUS = {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    RESOLVED: 'RESOLVED',
} as const;

export const COMORBIDITY_STATUS = {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    HISTORY: 'HISTORY',
    RESOLVED: 'RESOLVED',
} as const;

export const ENCOUNTER_SYMPTOM_STATUS = {
    ACTIVE: 'ACTIVE',
    RESOLVED: 'RESOLVED',
    CHRONIC: 'CHRONIC',
} as const;

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;

export const CLINICAL_DETAILS_PERMISSIONS = {
    MASTER_CREATE: 'clinical_details.master.create',
    MASTER_READ: 'clinical_details.master.read',
    MASTER_UPDATE: 'clinical_details.master.update',
    MASTER_DELETE: 'clinical_details.master.delete',
    CLINICAL_CREATE: 'clinical_details.clinical.create',
    CLINICAL_READ: 'clinical_details.clinical.read',
    CLINICAL_UPDATE: 'clinical_details.clinical.update',
    CLINICAL_DELETE: 'clinical_details.clinical.delete',
} as const;