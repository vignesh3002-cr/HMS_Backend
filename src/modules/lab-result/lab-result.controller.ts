import { Request, Response } from "express";
import { LabResultService } from "./lab-result.service";

const service = new LabResultService();

export class LabResultController {
  async getByOrderItemId(req: Request, res: Response) {
    try {
      const orderItemId = String(req.params.orderItemId);
      const results = await service.getByOrderItemId(orderItemId);
      return res.json({
        success: true,
        data: results
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const result = await service.getById(id);
      return res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const result = await service.create(req.body);
      return res.status(201).json({
        success: true,
        data: result
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async batchSave(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const payload = {
        ...req.body,
        verified_by: req.body.verified_by || user?.employee_id || user?.username,
        user_id: user?.user_id || req.body.user_id,
        branch_id: req.body.branch_id || (req.headers["x-branch-id"] as string)
      };

      const result = await service.batchSave(payload);
      return res.status(200).json({
        success: true,
        message: req.body.markCompleted
          ? "Lab test results saved and marked as completed successfully."
          : "Lab test draft results saved successfully.",
        data: result
      });
    } catch (error: any) {
      console.error("Batch save error:", error);
      return res.status(400).json({
        success: false,
        message: error.message || "Failed to batch save lab results"
      });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const updated = await service.update(id, req.body);
      return res.json({
        success: true,
        data: updated
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      await service.delete(id);
      return res.json({
        success: true,
        message: "Lab result deleted successfully"
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
}

