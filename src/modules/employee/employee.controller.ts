import {Request, Response } from "express";
import { EmployeeService } from "./employee.service";
import { AuthRequest } from "../auth/auth.middleware";
import prisma from "../../config/prisma";
import { ADMIN_ROLES } from "../../middleware/authorize";
 
const service = new EmployeeService();
 
export class EmployeeController {
 
    async createEmployee(req: Request, res: Response) {
 
        try {
 
            // Log incoming (non-sensitive) request body for debugging
            try {
                const safeBody = {
                    username: req.body?.username,
                    email: req.body?.email,
                    mobile_no: req.body?.mobile_no,
                    department_id: req.body?.department_id,
                    branch_ids: Array.isArray(req.body?.branch_ids) ? req.body.branch_ids : undefined,
                    role_type: req.body?.role_type,
                };
                console.info("createEmployee request", safeBody);
            } catch (logErr) {
                console.error("Failed to log createEmployee request", logErr);
            }
 
            const createdBy = (req as any).user?.user_id || "SYSTEM";
 
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
 
                // Log a minimal, non-sensitive subset of the request body to aid debugging.
                // Avoid logging passwords or other sensitive fields.
                try {
                    const safeBody = {
                        username: req.body?.username,
                        email: req.body?.email,
                        mobile_no: req.body?.mobile_no,
                        department_id: req.body?.department_id,
                        branch_ids: Array.isArray(req.body?.branch_ids) ? req.body.branch_ids : undefined,
                    };
                    console.error("Failed to create employee", { error: error?.message, body: safeBody });
                } catch (logErr) {
                    console.error("Failed to log createEmployee error", logErr);
                }
 
                return res.status(400).json({
                    success: false,
                    message: error.message,
                });
 
        }
 
    }
    async updateEmployee(req: Request, res: Response) {
    try {
 
 
 
        const employee = await service.updateEmployee(
            String(req.params.employeeId),
            req.body,
            (req as any).user?.user_id
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
async softDeleteSchedule(req: Request, res: Response) {
    try {
        const result = await service.softDeleteSchedule(
            String(req.params.employeeId),
            Number(req.params.schedule_id),
            (req as any).user?.user_id || "SYSTEM"
        );
        return res.status(200).json({
            success: true,
            message: result.message
        });
    } catch (error: any) {
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to delete schedule slot"
        });
    }
}
async softDeleteEmployee(req: Request, res: Response) {
 
    try {
 
        const result = await service.softDeleteEmployee(
            String(req.params.employeeId),
            (req as any).user?.user_id || "SYSTEM"
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
async restoreEmployee(req: Request, res: Response) {

    try {

        const result = await service.restoreEmployee(
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

            const query = {
                roleType: req.query.roleType as string | undefined,
                branchId: req.query.branchId as string | undefined,
                department: req.query.department as string | undefined,
                status: req.query.status !== undefined ? req.query.status === "true" : undefined,
                includeDeleted: req.query.includeDeleted === "true",
                search: req.query.search as string | undefined,
                page: req.query.page ? Number(req.query.page) : 1,
                limit: req.query.limit ? Number(req.query.limit) : 10,
                excludeEmployeeId: undefined as string | undefined,
                date: req.query.date as string | undefined,
            };

            // Admins never see their own record in employee lists - self
            // management happens only through the read-only own profile.
            const authReq = req as AuthRequest;
            if (authReq.user && ADMIN_ROLES.includes(String(authReq.user.role ?? "").toUpperCase())) {
                const own = await prisma.employees.findUnique({
                    where: { user_id: authReq.user.user_id },
                    select: { employee_id: true },
                });
                query.excludeEmployeeId = own?.employee_id ?? undefined;
            }

            const result = await service.getEmployees(query);

            return res.status(200).json({
                success: true,
                message: "Employees fetched successfully",
                data: result
            });
 
        } catch (error: any) {
 
            return res.status(400).json({
                success: false,
                message: error.message
            });
 
        }
 
    }
    async updateEmployeePhoto(req: Request, res: Response) {

        try {

            const { employee_photo_URL } = req.body;

            if (!employee_photo_URL || typeof employee_photo_URL !== "string") {
                return res.status(400).json({
                    success: false,
                    message: "employee_photo_URL is required"
                });
            }

            const employee = await service.updateEmployeePhoto(
                String(req.params.employeeId),
                employee_photo_URL
            );

            return res.status(200).json({
                success: true,
                message: "Photo updated successfully",
                data: employee
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }
    // GET /employees/me — the signed-in user's own full profile. Must be
    // matched before /:employeeId (which would otherwise treat "me" as an
    // id and fail with "Employee not found"). No branchScope here: self
    // access is not branch-filtered.
    async getMyProfile(req: Request, res: Response) {

        try {

            const userId = (req as any).user?.user_id;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: "Unauthorized"
                });
            }

            const own = await prisma.employees.findUnique({
                where: { user_id: userId },
                select: { employee_id: true },
            });

            if (!own?.employee_id) {
                return res.status(404).json({
                    success: false,
                    message: "No employee profile is linked to this account."
                });
            }

            const employee = await service.getEmployeeById(own.employee_id);

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
    async getEmployeeById(req: Request, res: Response) {
 
        try {
            console.log("Fetching employee by ID:", req.params.employeeId);
            const employee = await service.getEmployeeById(String(req.params.employeeId));
           
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
}