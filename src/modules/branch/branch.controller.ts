import { Request, Response } from "express";
import { BranchService } from "./branch.service";

const service = new BranchService();

export class BranchController {

    // ✅ Add this method for GET all branches
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

    async createBranch(req: Request, res: Response) {

        try {

            const createdBy = "SA001"; // Replace later with JWT logged-in user
            const hospitalId = "HSP001"; // Replace later with JWT logged-in user (matches the hospital row's actual hospital_id)

            const result = await service.createBranch(
                req.body,
                createdBy,
                hospitalId
            );

            return res.status(201).json({
                success: true,
                message: "Branch created successfully",
                data: result
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }
    async updateBranch(req: Request, res: Response) {
    try {
        const branchId = String(req.params.branchId);

        const result = await service.updateBranch(
            branchId,
            req.body
        );

        return res.status(200).json({
            success: true,
            message: "Branch updated successfully",
            data: result
        });

    } catch (error: any) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
    
}
async deleteBranch(
    req: Request<{ branchId: string }>,
    res: Response
) {
    try {
        const branchId = req.params.branchId;
        console.log("Controller Branch ID:", branchId);

        const result = await service.deleteBranch(branchId);

        return res.status(200).json({
            success: true,
            message: "Branch deleted successfully",
            data: result
        });

    } catch (error: any) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
}
}
