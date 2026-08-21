"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const clinical_details_controller_1 = require("./clinical-details.controller");
const auth_middleware_1 = require("../auth/auth.middleware");
const clinical_details_validation_1 = require("./clinical-details.validation");
const router = (0, express_1.Router)();
const controller = new clinical_details_controller_1.ClinicalDetailsController();
// Master data routes (Admin only)
router.post('/master/performance-status', auth_middleware_1.authenticate, clinical_details_validation_1.createPerformanceStatusValidation, controller.createPerformanceStatus.bind(controller));
router.put('/master/performance-status/:id', auth_middleware_1.authenticate, clinical_details_validation_1.updatePerformanceStatusValidation, controller.updatePerformanceStatus.bind(controller));
router.get('/master/performance-status', auth_middleware_1.authenticate, clinical_details_validation_1.getMasterListValidation, controller.getPerformanceStatuses.bind(controller));
router.post('/master/symptoms', auth_middleware_1.authenticate, clinical_details_validation_1.createSymptomValidation, controller.createSymptom.bind(controller));
router.put('/master/symptoms/:id', auth_middleware_1.authenticate, clinical_details_validation_1.updateSymptomValidation, controller.updateSymptom.bind(controller));
router.get('/master/symptoms', auth_middleware_1.authenticate, clinical_details_validation_1.getMasterListValidation, controller.getSymptoms.bind(controller));
router.post('/master/allergies', auth_middleware_1.authenticate, clinical_details_validation_1.createAllergyValidation, controller.createAllergy.bind(controller));
router.put('/master/allergies/:id', auth_middleware_1.authenticate, clinical_details_validation_1.updateAllergyValidation, controller.updateAllergy.bind(controller));
router.get('/master/allergies', auth_middleware_1.authenticate, clinical_details_validation_1.getMasterListValidation, controller.getAllergies.bind(controller));
// Clinical routes (Doctor/Clinician access)
router.put('/encounters/:encounterNo/performance-status', auth_middleware_1.authenticate, clinical_details_validation_1.createEncounterPerformanceStatusValidation, controller.setEncounterPerformanceStatus.bind(controller));
router.get('/encounters/:encounterNo/performance-status', auth_middleware_1.authenticate, clinical_details_validation_1.getClinicalDetailsValidation, controller.getEncounterPerformanceStatus.bind(controller));
router.post('/encounters/:encounterNo/symptoms', auth_middleware_1.authenticate, clinical_details_validation_1.createEncounterSymptomValidation, controller.addEncounterSymptom.bind(controller));
router.get('/encounters/:encounterNo/symptoms', auth_middleware_1.authenticate, clinical_details_validation_1.getClinicalDetailsValidation, controller.getEncounterSymptoms.bind(controller));
router.put('/encounters/:encounterNo/symptoms/:symptomId', auth_middleware_1.authenticate, clinical_details_validation_1.updateEncounterSymptomValidation, controller.updateEncounterSymptom.bind(controller));
router.delete('/encounters/:encounterNo/symptoms/:symptomId', auth_middleware_1.authenticate, clinical_details_validation_1.updateEncounterSymptomValidation, controller.removeEncounterSymptom.bind(controller));
router.post('/patients/:patientId/allergies', auth_middleware_1.authenticate, clinical_details_validation_1.createPatientAllergyValidation, controller.addPatientAllergy.bind(controller));
router.get('/patients/:patientId/allergies', auth_middleware_1.authenticate, clinical_details_validation_1.getMasterListValidation, controller.getPatientAllergies.bind(controller));
router.put('/patients/:patientId/allergies/:recordId', auth_middleware_1.authenticate, clinical_details_validation_1.updatePatientAllergyValidation, controller.updatePatientAllergy.bind(controller));
router.delete('/patients/:patientId/allergies/:recordId', auth_middleware_1.authenticate, clinical_details_validation_1.updatePatientAllergyValidation, controller.removePatientAllergy.bind(controller));
router.post('/patients/:patientId/comorbidities', auth_middleware_1.authenticate, clinical_details_validation_1.createPatientComorbidityValidation, controller.addPatientComorbidity.bind(controller));
router.get('/patients/:patientId/comorbidities', auth_middleware_1.authenticate, clinical_details_validation_1.getMasterListValidation, controller.getPatientComorbidities.bind(controller));
router.put('/patients/:patientId/comorbidities/:recordId', auth_middleware_1.authenticate, clinical_details_validation_1.updatePatientComorbidityValidation, controller.updatePatientComorbidity.bind(controller));
router.delete('/patients/:patientId/comorbidities/:recordId', auth_middleware_1.authenticate, clinical_details_validation_1.updatePatientComorbidityValidation, controller.removePatientComorbidity.bind(controller));
// Consolidated clinical details endpoint
router.get('/encounters/:encounterNo', auth_middleware_1.authenticate, clinical_details_validation_1.getClinicalDetailsValidation, controller.getCompleteClinicalDetails.bind(controller));
exports.default = router;
