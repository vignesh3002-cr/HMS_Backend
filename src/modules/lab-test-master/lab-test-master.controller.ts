import { Request, Response } from "express";
import { validationResult } from "express-validator";
import service from "./lab-test-master.service";

class LabTestMasterController {

    async create(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const test = await service.create(req.body);

            return res.status(201).json({
                success: true,
                message: "Lab Test created successfully",
                data: test
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

            const tests = await service.getAll();

            return res.status(200).json({
                success: true,
                data: tests
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

            const test = await service.getById(String(req.params.id));

            return res.status(200).json({
                success: true,
                data: test
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

            const test = await service.update(
                String(req.params.id),
                req.body
            );

            return res.status(200).json({
                success: true,
                message: "Lab Test updated successfully",
                data: test
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

            return res.status(200).json({
                success: true,
                message: "Lab Test deleted successfully"
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

}

export default new LabTestMasterController();