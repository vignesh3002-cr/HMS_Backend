import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { LabOrderItemService } from "./lab-order-item.service";

const service = new LabOrderItemService();

export class LabOrderItemController {

    async create(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const item = await service.create(req.body);

            return res.status(201).json({
                success: true,
                data: item
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

            const items = await service.getAll();

            return res.json({
                success: true,
                data: items
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

            const item = await service.getById(req.params.id as string);

            return res.json({
                success: true,
                data: item
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

            const item = await service.update(
                req.params.id as string,
                req.body
            );

            return res.json({
                success: true,
                data: item
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

            await service.delete (req.params.id as string);

            return res.json({
                success: true,
                message: "Lab Order Item deleted successfully"
            });

        } catch (error: any) {

            return res.status(404).json({
                success: false,
                message: error.message
            });

        }

    }

}