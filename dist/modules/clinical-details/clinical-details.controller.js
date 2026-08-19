"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClinicalDetailsController = void 0;
const express_validator_1 = require("express-validator");
const clinical_details_service_1 = require("./clinical-details.service");
const service = new clinical_details_service_1.ClinicalDetailsService();
function getUserIdentifier(req) {
    return req.user?.employee_id || req.user?.user_id || 'SYSTEM';
}
// Columns like assessed_by/recorded_by/identified_by FK to
// employees.employee_id - user_id (the JWT subject) is a different ID space
// and 'SYSTEM' isn't a real employee either, so return null unless the user
// actually has an employee profile.
function getEmployeeIdentifier(req) {
    return req.user?.employee_id ?? null;
}
function getUserRole(req) {
    return String(req.user?.role || '').toUpperCase();
}
class ClinicalDetailsController {
    async createPerformanceStatus(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }
            const createdBy = getUserIdentifier(req);
            const perfStatus = await service.createPerformanceStatus({ ...req.body, createdBy });
            return res.status(201).json({
                success: true,
                message: 'Performance status created successfully',
                data: perfStatus,
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }
    async updatePerformanceStatus(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }
            const id = Number(req.params.id);
            const updatedBy = getUserIdentifier(req);
            const perfStatus = await service.updatePerformanceStatus(id, { ...req.body, updatedBy });
            return res.json({
                success: true,
                message: 'Performance status updated successfully',
                data: perfStatus,
            });
        }
        catch (error) {
            const status = error.message.includes('not found') ? 404 : 400;
            return res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }
    async getPerformanceStatuses(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }
            const query = {
                page: Number(req.query.page || 1),
                limit: Number(req.query.limit || 50),
                search: req.query.search,
                isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
            };
            const result = await service.getPerformanceStatuses(query);
            return res.json({
                success: true,
                message: 'Performance statuses fetched successfully',
                data: result,
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }
    async createSymptom(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }
            const createdBy = getUserIdentifier(req);
            const symptom = await service.createSymptom({ ...req.body, createdBy });
            return res.status(201).json({
                success: true,
                message: 'Symptom created successfully',
                data: symptom,
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }
    async updateSymptom(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }
            const id = Number(req.params.id);
            const updatedBy = getUserIdentifier(req);
            const symptom = await service.updateSymptom(id, { ...req.body, updatedBy });
            return res.json({
                success: true,
                message: 'Symptom updated successfully',
                data: symptom,
            });
        }
        catch (error) {
            const status = error.message.includes('not found') ? 404 : 400;
            return res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }
    async getSymptoms(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }
            const query = {
                page: Number(req.query.page || 1),
                limit: Number(req.query.limit || 50),
                search: req.query.search,
                isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
                category: req.query.category,
            };
            const result = await service.getSymptoms(query);
            return res.json({
                success: true,
                message: 'Symptoms fetched successfully',
                data: result,
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }
    async createAllergy(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }
            const createdBy = getUserIdentifier(req);
            const allergy = await service.createAllergy({ ...req.body, createdBy });
            return res.status(201).json({
                success: true,
                message: 'Allergy created successfully',
                data: allergy,
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }
    async updateAllergy(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }
            const id = Number(req.params.id);
            const updatedBy = getUserIdentifier(req);
            const allergy = await service.updateAllergy(id, { ...req.body, updatedBy });
            return res.json({
                success: true,
                message: 'Allergy updated successfully',
                data: allergy,
            });
        }
        catch (error) {
            const status = error.message.includes('not found') ? 404 : 400;
            return res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }
    async getAllergies(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }
            const query = {
                page: Number(req.query.page || 1),
                limit: Number(req.query.limit || 50),
                search: req.query.search,
                isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
                substanceType: req.query.substanceType,
            };
            const result = await service.getAllergies(query);
            return res.json({
                success: true,
                message: 'Allergies fetched successfully',
                data: result,
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }
    async setEncounterPerformanceStatus(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }
            const assessedBy = getEmployeeIdentifier(req);
            const encounterNo = req.params.encounterNo;
            const perfStatus = await service.setEncounterPerformanceStatus({ ...req.body, encounterNo }, assessedBy);
            return res.json({
                success: true,
                message: 'Encounter performance status updated successfully',
                data: perfStatus,
            });
        }
        catch (error) {
            const status = error.message.includes('not found') ? 404 : 400;
            return res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }
    async getEncounterPerformanceStatus(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }
            const encounterNo = req.params.encounterNo;
            const perfStatus = await service.getEncounterPerformanceStatus(encounterNo);
            if (!perfStatus) {
                return res.status(404).json({
                    success: false,
                    message: 'Performance status not found for this encounter',
                });
            }
            return res.json({
                success: true,
                message: 'Encounter performance status fetched successfully',
                data: perfStatus,
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }
    async addEncounterSymptom(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }
            const recordedBy = getEmployeeIdentifier(req);
            const encounterNo = req.params.encounterNo;
            const symptom = await service.addEncounterSymptom({ ...req.body, encounterNo }, recordedBy);
            return res.status(201).json({
                success: true,
                message: 'Encounter symptom added successfully',
                data: symptom,
            });
        }
        catch (error) {
            const status = error.message.includes('not found') ? 404 : error.message.includes('already') ? 409 : 400;
            return res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }
    async getEncounterSymptoms(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }
            const encounterNo = req.params.encounterNo;
            const symptoms = await service.getEncounterSymptoms(encounterNo);
            return res.json({
                success: true,
                message: 'Encounter symptoms fetched successfully',
                data: symptoms,
            });
        }
        catch (error) {
            const status = error.message.includes('not found') ? 404 : 500;
            return res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }
    async updateEncounterSymptom(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }
            const { encounterNo, symptomId } = req.params;
            const updatedBy = getUserIdentifier(req);
            const symptom = await service.updateEncounterSymptom(encounterNo, Number(symptomId), req.body, updatedBy);
            return res.json({
                success: true,
                message: 'Encounter symptom updated successfully',
                data: symptom,
            });
        }
        catch (error) {
            const status = error.message.includes('not found') ? 404 : 400;
            return res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }
    async removeEncounterSymptom(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }
            const { encounterNo, symptomId } = req.params;
            await service.removeEncounterSymptom(encounterNo, Number(symptomId));
            return res.json({
                success: true,
                message: 'Encounter symptom removed successfully',
            });
        }
        catch (error) {
            const status = error.message.includes('not found') ? 404 : 400;
            return res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }
    async addPatientAllergy(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }
            const patientId = req.params.patientId;
            const identifiedBy = getEmployeeIdentifier(req);
            const allergy = await service.addPatientAllergy(patientId, req.body, identifiedBy);
            return res.status(201).json({
                success: true,
                message: 'Patient allergy added successfully',
                data: allergy,
            });
        }
        catch (error) {
            const status = error.message.includes('not found') ? 404 : error.message.includes('already') ? 409 : 400;
            return res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }
    async getPatientAllergies(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }
            const patientId = req.params.patientId;
            const allergies = await service.getPatientAllergies(patientId);
            return res.json({
                success: true,
                message: 'Patient allergies fetched successfully',
                data: allergies,
            });
        }
        catch (error) {
            const status = error.message.includes('not found') ? 404 : 500;
            return res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }
    async updatePatientAllergy(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }
            const patientId = req.params.patientId;
            const recordId = Number(req.params.recordId);
            const updatedBy = getUserIdentifier(req);
            const allergy = await service.updatePatientAllergy(patientId, recordId, req.body, updatedBy);
            return res.json({
                success: true,
                message: 'Patient allergy updated successfully',
                data: allergy,
            });
        }
        catch (error) {
            const status = error.message.includes('not found') ? 404 : error.message.includes('belong') ? 403 : 400;
            return res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }
    async removePatientAllergy(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }
            const patientId = req.params.patientId;
            const recordId = Number(req.params.recordId);
            await service.removePatientAllergy(patientId, recordId);
            return res.json({
                success: true,
                message: 'Patient allergy removed successfully',
            });
        }
        catch (error) {
            const status = error.message.includes('not found') ? 404 : error.message.includes('belong') ? 403 : 400;
            return res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }
    async addPatientComorbidity(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }
            const patientId = req.params.patientId;
            const identifiedBy = getEmployeeIdentifier(req);
            const comorbidity = await service.addPatientComorbidity(patientId, req.body, identifiedBy);
            return res.status(201).json({
                success: true,
                message: 'Patient comorbidity added successfully',
                data: comorbidity,
            });
        }
        catch (error) {
            const status = error.message.includes('not found') ? 404 : error.message.includes('already') ? 409 : 400;
            return res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }
    async getPatientComorbidities(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }
            const patientId = req.params.patientId;
            const comorbidities = await service.getPatientComorbidities(patientId);
            return res.json({
                success: true,
                message: 'Patient comorbidities fetched successfully',
                data: comorbidities,
            });
        }
        catch (error) {
            const status = error.message.includes('not found') ? 404 : 500;
            return res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }
    async updatePatientComorbidity(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }
            const patientId = req.params.patientId;
            const recordId = Number(req.params.recordId);
            const updatedBy = getUserIdentifier(req);
            const comorbidity = await service.updatePatientComorbidity(patientId, recordId, req.body, updatedBy);
            return res.json({
                success: true,
                message: 'Patient comorbidity updated successfully',
                data: comorbidity,
            });
        }
        catch (error) {
            const status = error.message.includes('not found') ? 404 : error.message.includes('belong') ? 403 : 400;
            return res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }
    async removePatientComorbidity(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }
            const patientId = req.params.patientId;
            const recordId = Number(req.params.recordId);
            await service.removePatientComorbidity(patientId, recordId);
            return res.json({
                success: true,
                message: 'Patient comorbidity removed successfully',
            });
        }
        catch (error) {
            const status = error.message.includes('not found') ? 404 : error.message.includes('belong') ? 403 : 400;
            return res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }
    async getCompleteClinicalDetails(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }
            const encounterNo = req.params.encounterNo;
            const clinicalDetails = await service.getCompleteClinicalDetails(encounterNo);
            if (!clinicalDetails) {
                return res.status(404).json({
                    success: false,
                    message: 'Encounter not found',
                });
            }
            return res.json({
                success: true,
                message: 'Clinical details fetched successfully',
                data: clinicalDetails,
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }
}
exports.ClinicalDetailsController = ClinicalDetailsController;
