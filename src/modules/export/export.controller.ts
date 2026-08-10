import { Request, Response } from "express";
import { exportService } from "./export.service";

const dateStamp = (): string => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const sendCsv = (res: Response, filename: string, csv: string): void => {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
};

export async function exportEmployees(req: Request, res: Response) {
    try {
        const csv = await exportService.buildEmployeesCsv({
            branchId: req.query.branchId as string | undefined,
            roleType: req.query.roleType as string | undefined,
            excludeRoleType: req.query.excludeRoleType as string | undefined,
        });
        sendCsv(res, `employees-${dateStamp()}.csv`, csv);
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}

export async function exportPatients(req: Request, res: Response) {
    try {
        const csv = await exportService.buildPatientsCsv({
            branchId: req.query.branchId as string | undefined,
        });
        sendCsv(res, `patients-${dateStamp()}.csv`, csv);
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}

export async function exportAppointments(req: Request, res: Response) {
    try {
        const csv = await exportService.buildAppointmentsCsv({
            branchId: req.query.branchId as string | undefined,
            from: req.query.from as string | undefined,
            to: req.query.to as string | undefined,
        });
        sendCsv(res, `appointments-${dateStamp()}.csv`, csv);
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}
