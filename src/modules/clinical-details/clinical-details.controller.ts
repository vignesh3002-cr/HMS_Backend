import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { ClinicalDetailsService } from './clinical-details.service';

const service = new ClinicalDetailsService();

function getUserIdentifier(req: Request): string {
    return (req as any).user?.user_id || (req as any).user?.employee_id || 'SYSTEM';
}

function getUserRole(req: Request): string {
    return String((req as any).user?.role || '').toUpperCase();
}

export class ClinicalDetailsController {
    async createPerformanceStatus(req: Request, res: Response) {
        try {
            const errors = validationResult(req);
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
        } catch (error: any) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }

    async updatePerformanceStatus(req: Request, res: Response) {
        try {
            const errors = validationResult(req);
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
        } catch (error: any) {
            const status = error.message.includes('not found') ? 404 : 400;
            return res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }

    async getPerformanceStatuses(req: Request, res: Response) {
        try {
            const errors = validationResult(req);
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
                search: req.query.search as string,
                isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
            };

            const result = await service.getPerformanceStatuses(query);

            return res.json({
                success: true,
                message: 'Performance statuses fetched successfully',
                data: result,
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    async createSymptom(req: Request, res: Response) {
        try {
            const errors = validationResult(req);
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
        } catch (error: any) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }

    async updateSymptom(req: Request, res: Response) {
        try {
            const errors = validationResult(req);
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
        } catch (error: any) {
            const status = error.message.includes('not found') ? 404 : 400;
            return res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }

    async getSymptoms(req: Request, res: Response) {
        try {
            const errors = validationResult(req);
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
                search: req.query.search as string,
                isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
                category: req.query.category as string,
            };

            const result = await service.getSymptoms(query);

            return res.json({
                success: true,
                message: 'Symptoms fetched successfully',
                data: result,
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    async createAllergy(req: Request, res: Response) {
        try {
            const errors = validationResult(req);
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
        } catch (error: any) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }

    async updateAllergy(req: Request, res: Response) {
        try {
            const errors = validationResult(req);
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
        } catch (error: any) {
            const status = error.message.includes('not found') ? 404 : 400;
            return res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }

    async getAllergies(req: Request, res: Response) {
        try {
            const errors = validationResult(req);
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
                search: req.query.search as string,
                isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
                substanceType: req.query.substanceType as string,
            };

            const result = await service.getAllergies(query);

            return res.json({
                success: true,
                message: 'Allergies fetched successfully',
                data: result,
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    async setEncounterPerformanceStatus(req: Request, res: Response) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }

            const assessedBy = getUserIdentifier(req);
            const perfStatus = await service.setEncounterPerformanceStatus(req.body, assessedBy);

            return res.json({
                success: true,
                message: 'Encounter performance status updated successfully',
                data: perfStatus,
            });
        } catch (error: any) {
            const status = error.message.includes('not found') ? 404 : 400;
            return res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }

    async getEncounterPerformanceStatus(req: Request, res: Response) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }

            const encounterNo = req.params.encounterNo as string;
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
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    async addEncounterSymptom(req: Request, res: Response) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }

            const recordedBy = getUserIdentifier(req);
            const symptom = await service.addEncounterSymptom(req.body, recordedBy);

            return res.status(201).json({
                success: true,
                message: 'Encounter symptom added successfully',
                data: symptom,
            });
        } catch (error: any) {
            const status = error.message.includes('not found') ? 404 : error.message.includes('already') ? 409 : 400;
            return res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }

    async getEncounterSymptoms(req: Request, res: Response) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }

            const encounterNo = req.params.encounterNo as string;
            const symptoms = await service.getEncounterSymptoms(encounterNo);

            return res.json({
                success: true,
                message: 'Encounter symptoms fetched successfully',
                data: symptoms,
            });
        } catch (error: any) {
            const status = error.message.includes('not found') ? 404 : 500;
            return res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }

    async updateEncounterSymptom(req: Request, res: Response) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }

            const { encounterNo, symptomId } = req.params;
            const updatedBy = getUserIdentifier(req);
            const symptom = await service.updateEncounterSymptom(
                encounterNo as string,
                Number(symptomId),
                req.body,
                updatedBy
            );

            return res.json({
                success: true,
                message: 'Encounter symptom updated successfully',
                data: symptom,
            });
        } catch (error: any) {
            const status = error.message.includes('not found') ? 404 : 400;
            return res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }

    async removeEncounterSymptom(req: Request, res: Response) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }

            const { encounterNo, symptomId } = req.params;
            await service.removeEncounterSymptom(encounterNo as string, Number(symptomId));

            return res.json({
                success: true,
                message: 'Encounter symptom removed successfully',
            });
        } catch (error: any) {
            const status = error.message.includes('not found') ? 404 : 400;
            return res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }

    async addPatientAllergy(req: Request, res: Response) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }

            const patientId = req.params.patientId as string;
            const identifiedBy = getUserIdentifier(req);
            const allergy = await service.addPatientAllergy(patientId, req.body, identifiedBy);

            return res.status(201).json({
                success: true,
                message: 'Patient allergy added successfully',
                data: allergy,
            });
        } catch (error: any) {
            const status = error.message.includes('not found') ? 404 : error.message.includes('already') ? 409 : 400;
            return res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }

    async getPatientAllergies(req: Request, res: Response) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }

            const patientId = req.params.patientId as string;
            const allergies = await service.getPatientAllergies(patientId);

            return res.json({
                success: true,
                message: 'Patient allergies fetched successfully',
                data: allergies,
            });
        } catch (error: any) {
            const status = error.message.includes('not found') ? 404 : 500;
            return res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }

    async updatePatientAllergy(req: Request, res: Response) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }

            const patientId = req.params.patientId as string;
            const recordId = Number(req.params.recordId);
            const updatedBy = getUserIdentifier(req);
            const allergy = await service.updatePatientAllergy(patientId, recordId, req.body, updatedBy);

            return res.json({
                success: true,
                message: 'Patient allergy updated successfully',
                data: allergy,
            });
        } catch (error: any) {
            const status = error.message.includes('not found') ? 404 : error.message.includes('belong') ? 403 : 400;
            return res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }

    async removePatientAllergy(req: Request, res: Response) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }

            const patientId = req.params.patientId as string;
            const recordId = Number(req.params.recordId);
            await service.removePatientAllergy(patientId, recordId);

            return res.json({
                success: true,
                message: 'Patient allergy removed successfully',
            });
        } catch (error: any) {
            const status = error.message.includes('not found') ? 404 : error.message.includes('belong') ? 403 : 400;
            return res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }

    async addPatientComorbidity(req: Request, res: Response) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }

            const patientId = req.params.patientId as string;
            const identifiedBy = getUserIdentifier(req);
            const comorbidity = await service.addPatientComorbidity(patientId, req.body, identifiedBy);

            return res.status(201).json({
                success: true,
                message: 'Patient comorbidity added successfully',
                data: comorbidity,
            });
        } catch (error: any) {
            const status = error.message.includes('not found') ? 404 : error.message.includes('already') ? 409 : 400;
            return res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }

    async getPatientComorbidities(req: Request, res: Response) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }

            const patientId = req.params.patientId as string;
            const comorbidities = await service.getPatientComorbidities(patientId);

            return res.json({
                success: true,
                message: 'Patient comorbidities fetched successfully',
                data: comorbidities,
            });
        } catch (error: any) {
            const status = error.message.includes('not found') ? 404 : 500;
            return res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }

    async updatePatientComorbidity(req: Request, res: Response) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }

            const patientId = req.params.patientId as string;
            const recordId = Number(req.params.recordId);
            const updatedBy = getUserIdentifier(req);
            const comorbidity = await service.updatePatientComorbidity(patientId, recordId, req.body, updatedBy);

            return res.json({
                success: true,
                message: 'Patient comorbidity updated successfully',
                data: comorbidity,
            });
        } catch (error: any) {
            const status = error.message.includes('not found') ? 404 : error.message.includes('belong') ? 403 : 400;
            return res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }

    async removePatientComorbidity(req: Request, res: Response) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }

            const patientId = req.params.patientId as string;
            const recordId = Number(req.params.recordId);
            await service.removePatientComorbidity(patientId, recordId);

            return res.json({
                success: true,
                message: 'Patient comorbidity removed successfully',
            });
        } catch (error: any) {
            const status = error.message.includes('not found') ? 404 : error.message.includes('belong') ? 403 : 400;
            return res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }

    async getCompleteClinicalDetails(req: Request, res: Response) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }

            const encounterNo = req.params.encounterNo as string;
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
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }
}