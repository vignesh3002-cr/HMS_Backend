import {Request, Response } from "express";
import { EmployeeService } from "./employee.service";

const service = new EmployeeService();

export class EmployeeController {

    async createEmployee(req: Request, res: Response) {

        try {

            const createdBy = (req as any).user?.role || "SYSTEM";

            const employee = await service.createEmployee(
                req.body,
                createdBy
            );

            return res.status(201).json({

                success: true,

                message: "Employee created successfully",

                data: employee

            });

        } catch (error: any) {

            return res.status(400).json({

                success: false,

                message: error.message

            });

        }

    }
    async updateEmployee(req: Request, res: Response) {
    try {



        const employee = await service.updateEmployee(
            String(req.params.employeeId),
            req.body
        );

        return res.status(200).json({
            success: true,
            data: employee
        });

    } catch (error: any) {

        return res.status(400).json({
            success: false,
            message: error.message
        });

    }
    
}
async softDeleteEmployee(req: Request, res: Response) {

    try {

        const result = await service.softDeleteEmployee(
            String(req.params.employeeId)
        );

        return res.status(200).json({
            success: true,
            message: result.message
        });

    } catch (error: any) {

        return res.status(400).json({
            success: false,
            message: error.message
        });

    }

}
 async getAllEmployees(req: Request, res: Response) {

        try {

            const employees = await service.getAllEmployees();

            return res.status(200).json({
                success: true,
                data: employees
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

}

