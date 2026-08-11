import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { qualificationMasterService } from "./qualification-master.service";


export class QualificationMasterController {
  async create(req: Request, res: Response) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const qualification = await qualificationMasterService.create(req.body);

      return res.status(201).json({
        success: true,
        message: "Qualification created successfully",
        data: qualification,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const { designation } = req.query;

      let result;

      if (designation) {
        result = await qualificationMasterService.getByDesignation(
          designation as string
        );
      } else {
        result = await qualificationMasterService.getAll();
      }

      return res.status(200).json({
        success: true,
        count: result.length,
        data: result,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const qualification = await qualificationMasterService.getById (
        String(req.params.id)
      );

      return res.status(200).json({
        success: true,
        data: qualification,
      });
    } catch (error: any) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const qualification = await qualificationMasterService.update(
        String(req.params.id),
        req.body
      );

      return res.status(200).json({
        success: true,
        message: "Qualification updated successfully",
        data: qualification,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      await qualificationMasterService.delete (String(req.params.id));

      return res.status(200).json({
        success: true,
        message: "Qualification deleted successfully",
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
  async getByDesignation(req: Request, res: Response) {
  try {
    const designation = String(req.params.designation);

    const qualifications =
      await qualificationMasterService.getByDesignation(designation);

    return res.status(200).json({
      success: true,
      message: "Qualifications fetched successfully",
      data: qualifications,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
  
}

}

export const qualificationMasterController =
  new QualificationMasterController();