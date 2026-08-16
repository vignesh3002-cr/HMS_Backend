import { Router } from 'express';
import { ClinicalDetailsController } from './clinical-details.controller';
import { authenticate } from '../auth/auth.middleware';
import { authorize } from '../../middleware/authorize';
import {
    createPerformanceStatusValidation,
    updatePerformanceStatusValidation,
    createSymptomValidation,
    updateSymptomValidation,
    createAllergyValidation,
    updateAllergyValidation,
    createEncounterPerformanceStatusValidation,
    createEncounterSymptomValidation,
    updateEncounterSymptomValidation,
    createPatientAllergyValidation,
    updatePatientAllergyValidation,
    createPatientComorbidityValidation,
    updatePatientComorbidityValidation,
    getClinicalDetailsValidation,
    getMasterListValidation,
} from './clinical-details.validation';

const router = Router();
const controller = new ClinicalDetailsController();

// Master data routes (Admin only)
router.post(
    '/master/performance-status',
    authenticate,
    createPerformanceStatusValidation,
    controller.createPerformanceStatus.bind(controller)
);

router.put(
    '/master/performance-status/:id',
    authenticate,
    updatePerformanceStatusValidation,
    controller.updatePerformanceStatus.bind(controller)
);

router.get(
    '/master/performance-status',
    authenticate,
    getMasterListValidation,
    controller.getPerformanceStatuses.bind(controller)
);

router.post(
    '/master/symptoms',
    authenticate,
    createSymptomValidation,
    controller.createSymptom.bind(controller)
);

router.put(
    '/master/symptoms/:id',
    authenticate,
    updateSymptomValidation,
    controller.updateSymptom.bind(controller)
);

router.get(
    '/master/symptoms',
    authenticate,
    getMasterListValidation,
    controller.getSymptoms.bind(controller)
);

router.post(
    '/master/allergies',
    authenticate,
    createAllergyValidation,
    controller.createAllergy.bind(controller)
);

router.put(
    '/master/allergies/:id',
    authenticate,
    updateAllergyValidation,
    controller.updateAllergy.bind(controller)
);

router.get(
    '/master/allergies',
    authenticate,
    getMasterListValidation,
    controller.getAllergies.bind(controller)
);

// Clinical routes (Doctor/Clinician access)
router.put(
    '/encounters/:encounterNo/performance-status',
    authenticate,
    createEncounterPerformanceStatusValidation,
    controller.setEncounterPerformanceStatus.bind(controller)
);

router.get(
    '/encounters/:encounterNo/performance-status',
    authenticate,
    getClinicalDetailsValidation,
    controller.getEncounterPerformanceStatus.bind(controller)
);

router.post(
    '/encounters/:encounterNo/symptoms',
    authenticate,
    createEncounterSymptomValidation,
    controller.addEncounterSymptom.bind(controller)
);

router.get(
    '/encounters/:encounterNo/symptoms',
    authenticate,
    getClinicalDetailsValidation,
    controller.getEncounterSymptoms.bind(controller)
);

router.put(
    '/encounters/:encounterNo/symptoms/:symptomId',
    authenticate,
    updateEncounterSymptomValidation,
    controller.updateEncounterSymptom.bind(controller)
);

router.delete(
    '/encounters/:encounterNo/symptoms/:symptomId',
    authenticate,
    updateEncounterSymptomValidation,
    controller.removeEncounterSymptom.bind(controller)
);

router.post(
    '/patients/:patientId/allergies',
    authenticate,
    createPatientAllergyValidation,
    controller.addPatientAllergy.bind(controller)
);

router.get(
    '/patients/:patientId/allergies',
    authenticate,
    getMasterListValidation,
    controller.getPatientAllergies.bind(controller)
);

router.put(
    '/patients/:patientId/allergies/:recordId',
    authenticate,
    updatePatientAllergyValidation,
    controller.updatePatientAllergy.bind(controller)
);

router.delete(
    '/patients/:patientId/allergies/:recordId',
    authenticate,
    updatePatientAllergyValidation,
    controller.removePatientAllergy.bind(controller)
);

router.post(
    '/patients/:patientId/comorbidities',
    authenticate,
    createPatientComorbidityValidation,
    controller.addPatientComorbidity.bind(controller)
);

router.get(
    '/patients/:patientId/comorbidities',
    authenticate,
    getMasterListValidation,
    controller.getPatientComorbidities.bind(controller)
);

router.put(
    '/patients/:patientId/comorbidities/:recordId',
    authenticate,
    updatePatientComorbidityValidation,
    controller.updatePatientComorbidity.bind(controller)
);

router.delete(
    '/patients/:patientId/comorbidities/:recordId',
    authenticate,
    updatePatientComorbidityValidation,
    controller.removePatientComorbidity.bind(controller)
);

// Consolidated clinical details endpoint
router.get(
    '/encounters/:encounterNo',
    authenticate,
    getClinicalDetailsValidation,
    controller.getCompleteClinicalDetails.bind(controller)
);

export default router;