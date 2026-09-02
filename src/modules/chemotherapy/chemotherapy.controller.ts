import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { ChemotherapyService } from "./chemotherapy.service";

const service = new ChemotherapyService();

function actingUserId(req: Request): string {
    return (req as any).user?.user_id || "SYSTEM";
}

const CHEMO_TABLES = [
    "chemotherapy_plan", "chemotherapy_plan_items", "chemotherapy_cycle",
    "chemotherapy_administration", "chemotherapy_adverse_event",
    "chemotherapy_vitals", "chemotherapy_lab_review", "chemotherapy_followup"
];

function fieldFromConstraintName(constraintName: string): string {

    for (const table of CHEMO_TABLES) {

        if (constraintName.startsWith(`${table}_`) && constraintName.endsWith("_check")) {
            return constraintName.slice(table.length + 1, -"_check".length);
        }

    }

    return constraintName;

}

function handleError(res: Response, error: any) {

    if (typeof error?.clientVersion === "string") {

        console.error("[chemotherapy] database error:", error.message);

        const constraintMatch = /constraint "([a-zA-Z0-9_]+)"/.exec(error.message ?? "");

        return res.status(400).json({
            success: false,
            message: constraintMatch
                ? `Invalid value for '${fieldFromConstraintName(constraintMatch[1])}' - it does not match the allowed set of values for this field.`
                : "A database error occurred while saving this record."
        });

    }

    return res.status(400).json({
        success: false,
        message: error.message
    });

}

function checkValidation(req: Request, res: Response): boolean {

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
        return false;
    }

    return true;

}

export class ChemotherapyController {

    // ---------------- Regimen protocols ----------------

    async listRegimenProtocols(req: Request, res: Response) {

        try {

            const data = await service.listRegimenProtocols({
                cancer_type_id: req.query.cancer_type_id as string | undefined,
                subtype_id: req.query.subtype_id as string | undefined,
                organization_id: (req as any).user?.hospital_id ?? null
            });

            return res.json({ success: true, message: "Regimen protocols fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async getRegimenProtocol(req: Request, res: Response) {

        try {

            const data = await service.getRegimenProtocol(req.params.protocolId as string, (req as any).user?.hospital_id ?? null);
            return res.json({ success: true, message: "Regimen protocol fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async getDischargeMedicinesForProtocol(req: Request, res: Response) {

        try {

            const data = await service.getDischargeMedicinesForProtocol(req.params.protocolId as string, (req as any).user?.hospital_id ?? null);
            return res.json({ success: true, message: "Discharge medicines fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async listAllActiveMedicines(req: Request, res: Response) {

        try {

            const data = await service.listAllActiveMedicines();
            return res.json({ success: true, message: "Medicines fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async listDilutionMedicines(req: Request, res: Response) {

        try {

            const data = await service.listDilutionMedicines();
            return res.json({ success: true, message: "Dilution medicines fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async listMedicinesByDrugRole(req: Request, res: Response) {

        try {

            const drugRole = req.query.drug_role as string;

            if (!drugRole) {
                return res.status(400).json({ success: false, message: "drug_role is required" });
            }

            const data = await service.listMedicinesByDrugRole(drugRole);
            return res.json({ success: true, message: "Medicines fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async getProtocolFieldOptions(req: Request, res: Response) {

        try {

            const data = await service.getProtocolFieldOptions();
            return res.json({ success: true, message: "Protocol field options fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async getMedicinesByCancerTypeAndSubtype(req: Request, res: Response) {

        try {

            const cancerTypeId = req.query.cancer_type_id as string;
            const subtypeId = req.query.subtype_id as string;
            const drugRole = req.query.drug_role as string;

            if (!cancerTypeId || !drugRole) {
                return res.status(400).json({ success: false, message: "cancer_type_id and drug_role are required" });
            }

            const data = await service.getMedicinesByCancerTypeAndSubtype(cancerTypeId, subtypeId, drugRole);
            return res.json({ success: true, message: "Medicines fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async createRegimenProtocol(req: Request, res: Response) {

        try {

            if (!checkValidation(req, res)) return;

            const data = await service.createRegimenProtocol(req.body, actingUserId(req));
            return res.status(201).json({ success: true, message: "Regimen protocol created successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async updateRegimenProtocol(req: Request, res: Response) {

        try {

            if (!checkValidation(req, res)) return;

            const data = await service.updateRegimenProtocol(req.params.protocolId as string, req.body, actingUserId(req));
            return res.json({ success: true, message: "Regimen protocol updated successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async addRegimenProtocolItem(req: Request, res: Response) {

        try {

            if (!checkValidation(req, res)) return;

            const data = await service.addRegimenProtocolItem(req.params.protocolId as string, req.body, actingUserId(req));
            return res.status(201).json({ success: true, message: "Protocol item added successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async removeRegimenProtocolItem(req: Request, res: Response) {

        try {

            const data = await service.removeRegimenProtocolItem(req.params.protocolId as string, req.params.protocolItemId as string, actingUserId(req));
            return res.json({ success: true, message: "Protocol item removed successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async updateRegimenProtocolItem(req: Request, res: Response) {

        try {

            if (!checkValidation(req, res)) return;

            const data = await service.updateRegimenProtocolItem(req.params.protocolId as string, req.params.protocolItemId as string, req.body, actingUserId(req));
            return res.json({ success: true, message: "Protocol item updated successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async addDischargeInstruction(req: Request, res: Response) {

        try {

            if (!checkValidation(req, res)) return;

            const data = await service.addDischargeInstruction(req.params.protocolId as string, req.body, actingUserId(req));
            return res.status(201).json({ success: true, message: "Discharge instruction added successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async updateDischargeInstruction(req: Request, res: Response) {

        try {

            if (!checkValidation(req, res)) return;

            const data = await service.updateDischargeInstruction(req.params.protocolId as string, req.params.dischargeInstructionId as string, req.body, actingUserId(req));
            return res.json({ success: true, message: "Discharge instruction updated successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async removeDischargeInstruction(req: Request, res: Response) {

        try {

            const data = await service.removeDischargeInstruction(req.params.protocolId as string, req.params.dischargeInstructionId as string, actingUserId(req));
            return res.json({ success: true, message: "Discharge instruction removed successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    // ---------------- Personalized regimen protocols ----------------

    async listPersonalizedProtocols(req: Request, res: Response) {

        try {

            const data = await service.listPersonalizedProtocols((req as any).user?.hospital_id as string);
            return res.json({ success: true, message: "Personalized protocols fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async getPersonalizedProtocol(req: Request, res: Response) {

        try {

            const data = await service.getPersonalizedProtocol(req.params.protocolId as string, (req as any).user?.hospital_id as string);
            return res.json({ success: true, message: "Personalized protocol fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async personalizeProtocol(req: Request, res: Response) {

        try {

            if (!checkValidation(req, res)) return;

            const data = await service.personalizeProtocol(
                req.params.protocolId as string,
                (req as any).user?.hospital_id as string,
                actingUserId(req),
                req.body
            );

            return res.status(201).json({ success: true, message: "Protocol personalized successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async updatePersonalizedProtocol(req: Request, res: Response) {

        try {

            if (!checkValidation(req, res)) return;

            const data = await service.updatePersonalizedProtocol(
                req.params.protocolId as string,
                (req as any).user?.hospital_id as string,
                actingUserId(req),
                req.body
            );

            return res.json({ success: true, message: "Personalized protocol updated successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async addPersonalizedProtocolItem(req: Request, res: Response) {

        try {

            if (!checkValidation(req, res)) return;

            const data = await service.addPersonalizedProtocolItem(
                req.params.protocolId as string,
                (req as any).user?.hospital_id as string,
                actingUserId(req),
                req.body
            );

            return res.status(201).json({ success: true, message: "Protocol item added successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async updatePersonalizedProtocolItem(req: Request, res: Response) {

        try {

            if (!checkValidation(req, res)) return;

            const data = await service.updatePersonalizedProtocolItem(
                req.params.protocolId as string,
                req.params.protocolItemId as string,
                (req as any).user?.hospital_id as string,
                actingUserId(req),
                req.body
            );

            return res.json({ success: true, message: "Protocol item updated successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async removePersonalizedProtocolItem(req: Request, res: Response) {

        try {

            const data = await service.removePersonalizedProtocolItem(
                req.params.protocolId as string,
                req.params.protocolItemId as string,
                (req as any).user?.hospital_id as string,
                actingUserId(req)
            );

            return res.json({ success: true, message: "Protocol item removed successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async addPersonalizedProtocolDay(req: Request, res: Response) {

        try {

            if (!checkValidation(req, res)) return;

            const data = await service.addPersonalizedProtocolDay(
                req.params.protocolId as string,
                (req as any).user?.hospital_id as string,
                actingUserId(req),
                req.body
            );

            return res.status(201).json({ success: true, message: "Protocol day added successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async updatePersonalizedProtocolDay(req: Request, res: Response) {

        try {

            if (!checkValidation(req, res)) return;

            const data = await service.updatePersonalizedProtocolDay(
                req.params.protocolId as string,
                req.params.protocolDayId as string,
                (req as any).user?.hospital_id as string,
                actingUserId(req),
                req.body
            );

            return res.json({ success: true, message: "Protocol day updated successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async removePersonalizedProtocolDay(req: Request, res: Response) {

        try {

            const data = await service.removePersonalizedProtocolDay(
                req.params.protocolId as string,
                req.params.protocolDayId as string,
                (req as any).user?.hospital_id as string,
                actingUserId(req)
            );

            return res.json({ success: true, message: "Protocol day removed successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async addPersonalizedProtocolDilution(req: Request, res: Response) {

        try {

            if (!checkValidation(req, res)) return;

            const data = await service.addPersonalizedProtocolDilution(
                req.params.protocolId as string,
                req.params.protocolItemId as string,
                (req as any).user?.hospital_id as string,
                actingUserId(req),
                req.body
            );

            return res.status(201).json({ success: true, message: "Dilution added successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async updatePersonalizedProtocolDilution(req: Request, res: Response) {

        try {

            if (!checkValidation(req, res)) return;

            const data = await service.updatePersonalizedProtocolDilution(
                req.params.protocolId as string,
                req.params.protocolItemId as string,
                req.params.protocolDilutionId as string,
                (req as any).user?.hospital_id as string,
                actingUserId(req),
                req.body
            );

            return res.json({ success: true, message: "Dilution updated successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async removePersonalizedProtocolDilution(req: Request, res: Response) {

        try {

            const data = await service.removePersonalizedProtocolDilution(
                req.params.protocolId as string,
                req.params.protocolItemId as string,
                req.params.protocolDilutionId as string,
                (req as any).user?.hospital_id as string,
                actingUserId(req)
            );

            return res.json({ success: true, message: "Dilution removed successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async activatePersonalizedProtocol(req: Request, res: Response) {

        try {

            const data = await service.activatePersonalizedProtocol(
                req.params.protocolId as string,
                (req as any).user?.hospital_id as string,
                actingUserId(req)
            );

            return res.json({ success: true, message: "Personalized protocol activated successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async createPersonalizedProtocolVersion(req: Request, res: Response) {

        try {

            if (!checkValidation(req, res)) return;

            const data = await service.createPersonalizedProtocolVersion(
                req.params.protocolId as string,
                (req as any).user?.hospital_id as string,
                actingUserId(req),
                req.body
            );

            return res.status(201).json({ success: true, message: "Personalized protocol version created successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    // ---------------- Plan ----------------

    async previewPlan(req: Request, res: Response) {

        try {

            const data = await service.previewPlan(req.query.staging_detail_id as string, (req as any).user?.hospital_id ?? null);
            return res.json({ success: true, message: "Plan preview fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async createPlan(req: Request, res: Response) {

        try {

            if (!checkValidation(req, res)) return;

            const data = await service.createPlan(req.body, actingUserId(req), (req as any).user?.hospital_id ?? null);

            return res.status(201).json({ success: true, message: "Chemotherapy plan created successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async getPlan(req: Request, res: Response) {

        try {

            const data = await service.getPlan(req.params.planId as string);
            return res.json({ success: true, message: "Chemotherapy plan fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async listPlans(req: Request, res: Response) {

        try {

            const result = await service.listPlans({
                patient_id: req.query.patient_id as string | undefined,
                diagnosis_id: req.query.diagnosis_id as string | undefined,
                employee_id: req.query.employee_id as string | undefined,
                branch_id: req.query.branchId as string | undefined,
                department_id: req.query.department_id as string | undefined,
                status: req.query.status as string | undefined,
                date_from: req.query.date_from as string | undefined,
                date_to: req.query.date_to as string | undefined,
                page: req.query.page ? Number(req.query.page) : undefined,
                limit: req.query.limit ? Number(req.query.limit) : undefined
            });

            return res.json({
                success: true,
                message: "Chemotherapy plans fetched successfully",
                data: result.rows,
                pagination: { total: result.total, page: result.page, limit: result.limit }
            });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async getLatestPlanForPatient(req: Request, res: Response) {

        try {

            const patientId = String(req.query.patient_id ?? "");

            if (!patientId) {
                return res.status(400).json({
                    success: false,
                    message: "patient_id is required"
                });
            }

            const user = (req as any).user;

            const plan = await service.getLatestPlanForPatient(
                patientId,
                user?.user_id,
                user?.role
            );

            return res.json({
                success: true,
                message: "Latest chemotherapy plan fetched successfully",
                data: plan
            });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async updatePlan(req: Request, res: Response) {

        try {

            if (!checkValidation(req, res)) return;

            const data = await service.updatePlan(req.params.planId as string, req.body, actingUserId(req));
            return res.json({ success: true, message: "Chemotherapy plan updated successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async changePlanStatus(req: Request, res: Response) {

        try {

            if (!checkValidation(req, res)) return;

            const data = await service.changePlanStatus(req.params.planId as string, req.body, actingUserId(req));
            return res.json({ success: true, message: `Plan status updated to ${data.treatment_status}`, data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    // ---------------- Plan items ----------------

    async addPlanItem(req: Request, res: Response) {

        try {

            if (!checkValidation(req, res)) return;

            const data = await service.addPlanItem(req.params.planId as string, req.body, actingUserId(req));
            return res.status(201).json({ success: true, message: "Drug added to plan successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async updatePlanItem(req: Request, res: Response) {

        try {

            if (!checkValidation(req, res)) return;

            const data = await service.updatePlanItem(
                req.params.planId as string,
                req.params.planItemId as string,
                req.body,
                actingUserId(req)
            );

            return res.json({ success: true, message: "Plan item updated successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async removePlanItem(req: Request, res: Response) {

        try {

            const data = await service.removePlanItem(req.params.planId as string, req.params.planItemId as string, actingUserId(req));
            return res.json({ success: true, message: "Plan item removed successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    // ---------------- Cycles ----------------

    async createCycle(req: Request, res: Response) {

        try {

            if (!checkValidation(req, res)) return;

            const data = await service.createCycle(req.params.planId as string, req.body, actingUserId(req));
            return res.status(201).json({ success: true, message: "Cycle created successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async listCyclesForPlan(req: Request, res: Response) {

        try {

            const data = await service.listCyclesForPlan(req.params.planId as string);
            return res.json({ success: true, message: "Cycles fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async getCycle(req: Request, res: Response) {

        try {

            const data = await service.getCycle(req.params.cycleId as string);
            return res.json({ success: true, message: "Cycle fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async updateCycle(req: Request, res: Response) {

        try {

            if (!checkValidation(req, res)) return;

            const data = await service.updateCycle(req.params.cycleId as string, req.body, actingUserId(req));
            return res.json({ success: true, message: "Cycle updated successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async changeCycleStatus(req: Request, res: Response) {

        try {

            if (!checkValidation(req, res)) return;

            const data = await service.changeCycleStatus(req.params.cycleId as string, req.body, actingUserId(req));
            return res.json({ success: true, message: `Cycle status updated to ${data.cycle_status}`, data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    // ---------------- Administration ----------------

    async recordAdministration(req: Request, res: Response) {

        try {

            if (!checkValidation(req, res)) return;

            const data = await service.recordAdministration(req.params.cycleId as string, req.body, actingUserId(req));
            return res.status(201).json({ success: true, message: "Administration recorded successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async listAdministrations(req: Request, res: Response) {

        try {

            const data = await service.listAdministrations(req.params.cycleId as string);
            return res.json({ success: true, message: "Administrations fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    // ---------------- Vitals ----------------

    async recordVitals(req: Request, res: Response) {

        try {

            if (!checkValidation(req, res)) return;

            const data = await service.recordVitals(req.params.cycleId as string, req.body, actingUserId(req));
            return res.status(201).json({ success: true, message: "Vitals recorded successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async listVitals(req: Request, res: Response) {

        try {

            const data = await service.listVitals(req.params.cycleId as string);
            return res.json({ success: true, message: "Vitals fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    // ---------------- Adverse events ----------------

    async recordAdverseEvent(req: Request, res: Response) {

        try {

            if (!checkValidation(req, res)) return;

            const data = await service.recordAdverseEvent(req.params.cycleId as string, req.body, actingUserId(req));
            return res.status(201).json({ success: true, message: "Adverse event recorded successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async listAdverseEvents(req: Request, res: Response) {

        try {

            const data = await service.listAdverseEvents(req.params.cycleId as string);
            return res.json({ success: true, message: "Adverse events fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    // ---------------- Lab review ----------------

    async recordLabReview(req: Request, res: Response) {

        try {

            if (!checkValidation(req, res)) return;

            const data = await service.recordLabReview(req.params.cycleId as string, req.body, actingUserId(req));
            return res.status(201).json({ success: true, message: "Lab review recorded successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async listLabReviews(req: Request, res: Response) {

        try {

            const data = await service.listLabReviews(req.params.cycleId as string);
            return res.json({ success: true, message: "Lab reviews fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    // ---------------- Followup ----------------

    async recordFollowup(req: Request, res: Response) {

        try {

            if (!checkValidation(req, res)) return;

            const data = await service.recordFollowup(req.params.cycleId as string, req.body, actingUserId(req));
            return res.status(201).json({ success: true, message: "Follow-up recorded successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async listFollowups(req: Request, res: Response) {

        try {

            const data = await service.listFollowups(req.params.cycleId as string);
            return res.json({ success: true, message: "Follow-ups fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

}