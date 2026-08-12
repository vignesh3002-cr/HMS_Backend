import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { BranchService } from "./branch.service";

const service = new BranchService();

export class BranchController {
  async getAllBranches(req: Request, res: Response) {
    try {
      const branches = await service.getAllBranches();
      return res.status(200).json({
        success: true,
        data: branches,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getBranchById(req: Request, res: Response) {
    try {
      const branchId = String(req.params.branchId);
      const branch = await service.getBranchById(branchId);
      return res.status(200).json({
        success: true,
        message: "Branch fetched successfully",
        data: branch,
      });
    } catch (error: any) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }

  async createBranch(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array()[0].msg,
          errors: errors.array(),
        });
      }

      const createdBy = "SA001"; // TODO: from JWT
      const hospitalId = "HSP001"; // TODO: from JWT

      const result = await service.createBranch(req.body, createdBy, hospitalId);

      return res.status(201).json({
        success: true,
        message: "Branch created successfully",
        data: result,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async updateBranch(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array()[0].msg,
          errors: errors.array(),
        });
      }

      const branchId = String(req.params.branchId);
      const result = await service.updateBranch(branchId, req.body);

      return res.status(200).json({
        success: true,
        message: "Branch updated successfully",
        data: result,
      });
    } catch (error: any) {
      const statusCode = error.message === "Branch not found" ? 404 : 400;
      return res.status(statusCode).json({
        success: false,
        message: error.message,
      });
    }
  }

  async deleteBranch(req: Request, res: Response) {
    try {
      const branchId = String(req.params.branchId);
      const result = await service.deleteBranch(branchId);
      return res.status(200).json({
        success: true,
        message: "Branch deleted successfully",
        data: result,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // NEW: Get assignable admins
  async getAssignableAdmins(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array()[0].msg,
          errors: errors.array(),
        });
      }

      const search = req.query.search as string | undefined;
      const admins = await service.getAssignableAdmins(search);

      return res.status(200).json({
        success: true,
        data: admins,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // NEW: Assign/reassign admin to branch
  async assignAdmin(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array()[0].msg,
          errors: errors.array(),
        });
      }

      const branchId = String(req.params.branchId);
      const { user_id } = req.body;

      const result = await service.assignAdmin(branchId, user_id);

      return res.status(200).json(result);
    } catch (error: any) {
      const statusCode = error.message.includes("not found") ? 404 : 400;
      return res.status(statusCode).json({
        success: false,
        message: error.message,
      });
    }
  }

  // NEW: Explicitly unassign a Branch Admin (the "None" state)
  async unassignAdmin(req: Request, res: Response) {
    try {
      const userId = String(req.params.userId);

      const result = await service.unassignAdmin(userId);

      return res.status(200).json(result);
    } catch (error: any) {
      const statusCode = error.message.includes("not found") ? 404 : 400;
      return res.status(statusCode).json({
        success: false,
        message: error.message,
      });
    }
  }
}