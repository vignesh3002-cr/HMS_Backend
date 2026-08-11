import { Request, Response } from "express";
import * as auditService from "./audit.service";

export class AuditController {

    async listAuditLogs(req: Request, res: Response) {

        try {

            const result = await auditService.listAuditLogs({
                entity_type: req.query.entity_type as string | undefined,
                entity_id: req.query.entity_id as string | undefined,
                patient_id: req.query.patient_id as string | undefined,
                branch_id: req.query.branchId as string | undefined,
                performed_by: req.query.performed_by as string | undefined,
                action: req.query.action as string | undefined,
                date_from: req.query.date_from as string | undefined,
                date_to: req.query.date_to as string | undefined,
                page: req.query.page ? Number(req.query.page) : undefined,
                limit: req.query.limit ? Number(req.query.limit) : undefined
            });

            return res.json({
                success: true,
                message: "Audit logs fetched successfully",
                data: result.rows,
                pagination: { total: result.total, page: result.page, limit: result.limit }
            });

        } catch (error: any) {

            return res.status(400).json({ success: false, message: error.message });

        }

    }

}
