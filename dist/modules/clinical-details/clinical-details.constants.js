"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLINICAL_DETAILS_PERMISSIONS = exports.MAX_LIMIT = exports.DEFAULT_LIMIT = exports.DEFAULT_PAGE = exports.ENCOUNTER_SYMPTOM_STATUS = exports.COMORBIDITY_STATUS = exports.ALLERGY_STATUS = exports.ALLERGY_SEVERITY = exports.ALLERGY_TYPES = exports.SYMPTOM_SEVERITY = exports.SYMPTOM_CATEGORIES = exports.PERFORMANCE_STATUS_DEFAULT_CODE = exports.PERFORMANCE_STATUS_CODES = void 0;
exports.PERFORMANCE_STATUS_CODES = {
    ECOG_0: 'ECOG_0',
    ECOG_1: 'ECOG_1',
    ECOG_2: 'ECOG_2',
    ECOG_3: 'ECOG_3',
    ECOG_4: 'ECOG_4',
    ECOG_5: 'ECOG_5',
};
exports.PERFORMANCE_STATUS_DEFAULT_CODE = exports.PERFORMANCE_STATUS_CODES.ECOG_0;
exports.SYMPTOM_CATEGORIES = {
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
};
exports.SYMPTOM_SEVERITY = {
    MILD: 'MILD',
    MODERATE: 'MODERATE',
    SEVERE: 'SEVERE',
    CRITICAL: 'CRITICAL',
};
exports.ALLERGY_TYPES = {
    DRUG: 'DRUG',
    FOOD: 'FOOD',
    ENVIRONMENTAL: 'ENVIRONMENTAL',
    LATEX: 'LATEX',
    OTHER: 'OTHER',
};
exports.ALLERGY_SEVERITY = {
    MILD: 'MILD',
    MODERATE: 'MODERATE',
    SEVERE: 'SEVERE',
    ANAPHYLACTIC: 'ANAPHYLACTIC',
};
exports.ALLERGY_STATUS = {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    RESOLVED: 'RESOLVED',
};
exports.COMORBIDITY_STATUS = {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    HISTORY: 'HISTORY',
    RESOLVED: 'RESOLVED',
};
exports.ENCOUNTER_SYMPTOM_STATUS = {
    ACTIVE: 'ACTIVE',
    RESOLVED: 'RESOLVED',
    CHRONIC: 'CHRONIC',
};
exports.DEFAULT_PAGE = 1;
exports.DEFAULT_LIMIT = 50;
exports.MAX_LIMIT = 100;
exports.CLINICAL_DETAILS_PERMISSIONS = {
    MASTER_CREATE: 'clinical_details.master.create',
    MASTER_READ: 'clinical_details.master.read',
    MASTER_UPDATE: 'clinical_details.master.update',
    MASTER_DELETE: 'clinical_details.master.delete',
    CLINICAL_CREATE: 'clinical_details.clinical.create',
    CLINICAL_READ: 'clinical_details.clinical.read',
    CLINICAL_UPDATE: 'clinical_details.clinical.update',
    CLINICAL_DELETE: 'clinical_details.clinical.delete',
};
