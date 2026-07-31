import { Request, Response } from "express";
import { validationResult } from "express-validator";
import service from "./lab-test-category.service";

class LabTestCategoryController {

    async create(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const category = await service.create(req.body);

            return res.status(201).json({
                success: true,
                message: "Lab Test Category created successfully",
                data: category
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async getAll(req: Request, res: Response) {

        try {

            const categories = await service.getAll();

            return res.json({
                success: true,
                data: categories
            });

        } catch (error: any) {

            return res.status(500).json({
                success: false,
                message: error.message
            });

        }

    }

    async getById(req: Request, res: Response) {

        try {

            const category = await service.getById(String(req.params.id));

            return res.json({
                success: true,
                data: category
            });

        } catch (error: any) {

            return res.status(404).json({
                success: false,
                message: error.message
            });

        }

    }

    async update(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const category = await service.update(String(req.params.id), req.body);

            return res.json({
                success: true,
                message: "Lab Test Category updated successfully",
                data: category
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

            await service.delete(String(req.params.id));

            return res.json({
                success: true,
                message: "Lab Test Category deleted successfully"
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

}

export default new LabTestCategoryController();