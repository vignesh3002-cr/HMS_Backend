import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { HospitalService } from "./hospital.service";

const service = new HospitalService();

const httpError = (message: string, status: number) => {
  const err: any = new Error(message);
  err.status = status;
  return err;
};

export class HospitalController {
  async createHospital(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array()[0].msg,
          errors: errors.array(),
        });
      }

      const hospital = await service.create(req.body);

      return res.status(201).json({
        success: true,
        message: "Hospital created successfully",
        data: hospital,
      });
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message || "Failed to create hospital",
      });
    }
  }

  async getHospital(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array()[0].msg,
        });
      }

      const hospital = await service.getById(String(req.params.hospitalId));
      if (!hospital) {
        return res.status(404).json({
          success: false,
          message: "Hospital not found",
        });
      }

      return res.json({
        success: true,
        message: "Hospital fetched successfully",
        data: hospital,
      });
    } catch (error: any) {
      return res.status(error.status || 500).json({
        success: false,
        message: error.message || "Failed to fetch hospital",
      });
    }
  }

  async getAllHospitals(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await service.getAll(page, limit);

      return res.json({
        success: true,
        message: "Hospitals fetched successfully",
        data: result.hospitals,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch hospitals",
      });
    }
  }

  async updateHospital(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array()[0].msg,
          errors: errors.array(),
        });
      }

      const hospital = await service.update(String(req.params.hospitalId), req.body);

      return res.json({
        success: true,
        message: "Hospital updated successfully",
        data: hospital,
      });
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message || "Failed to update hospital",
      });
    }
  }
}