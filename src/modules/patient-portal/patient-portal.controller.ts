import { Response } from "express";
import { AuthRequest } from "../auth/auth.middleware";
import { PatientPortalService } from "./patient-portal.service";

const service = new PatientPortalService();

export class PatientPortalController {
  async getDashboard(req: AuthRequest, res: Response) {
    try {
      const patientId = await service.resolvePatientId(req.user);
      const data = await service.getDashboard(patientId);
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (err: any) {
      return res.status(err.message?.includes("not found") ? 404 : 500).json({
        success: false,
        message: err.message || "Failed to load patient dashboard",
      });
    }
  }

  async getAppointments(req: AuthRequest, res: Response) {
    try {
      const patientId = await service.resolvePatientId(req.user);
      const data = await service.getAppointments(patientId);
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to load appointments",
      });
    }
  }

  async getLabReports(req: AuthRequest, res: Response) {
    try {
      const patientId = await service.resolvePatientId(req.user);
      const data = await service.getLabReports(patientId);
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to load lab reports",
      });
    }
  }

  async getPrescriptions(req: AuthRequest, res: Response) {
    try {
      const patientId = await service.resolvePatientId(req.user);
      const data = await service.getPrescriptions(patientId);
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to load prescriptions",
      });
    }
  }

  async getVitalsHistory(req: AuthRequest, res: Response) {
    try {
      const patientId = await service.resolvePatientId(req.user);
      const data = await service.getVitalsHistory(patientId);
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to load vitals history",
      });
    }
  }

  async getAllergies(req: AuthRequest, res: Response) {
    try {
      const patientId = await service.resolvePatientId(req.user);
      const data = await service.getAllergies(patientId);
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to load allergies",
      });
    }
  }

  async getChemotherapyPlans(req: AuthRequest, res: Response) {
    try {
      const patientId = await service.resolvePatientId(req.user);
      const data = await service.getChemotherapyPlans(patientId);
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to load chemotherapy plans",
      });
    }
  }

  async getBranches(req: AuthRequest, res: Response) {
    try {
      const branches = await service.getBranches();
      return res.status(200).json({
        success: true,
        data: branches,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to fetch branches",
      });
    }
  }

  async getDepartments(req: AuthRequest, res: Response) {
    try {
      const branchId = req.query.branchId as string | undefined;
      const departments = await service.getDepartments(branchId);
      return res.status(200).json({
        success: true,
        data: departments,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to fetch departments",
      });
    }
  }

  async getDoctors(req: AuthRequest, res: Response) {
    try {
      const branchId = req.query.branchId as string | undefined;
      const departmentId = req.query.departmentId as string | undefined;
      const doctors = await service.getDoctors({ branchId, departmentId });
      return res.status(200).json({
        success: true,
        data: doctors,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to fetch doctors",
      });
    }
  }

  async getAvailableSlots(req: AuthRequest, res: Response) {
    try {
      const employeeId = req.query.employeeId as string;
      const branchId = req.query.branchId as string;
      const date = req.query.date as string;

      if (!employeeId || !branchId || !date) {
        return res.status(400).json({
          success: false,
          message: "employeeId, branchId, and date are required query parameters",
        });
      }

      const slotsResult = await service.getAvailableSlots(employeeId, branchId, date);
      return res.status(200).json({
        success: true,
        data: slotsResult,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: err.message || "Failed to fetch available slots",
      });
    }
  }

  async bookAppointment(req: AuthRequest, res: Response) {
    try {
      const patientId = await service.resolvePatientId(req.user);
      const appointment = await service.bookAppointment(patientId, req.body, req.user);
      return res.status(201).json({
        success: true,
        message: "Appointment booked successfully",
        data: appointment,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: err.message || "Failed to book appointment",
      });
    }
  }

  async cancelAppointment(req: AuthRequest, res: Response) {
    try {
      const patientId = await service.resolvePatientId(req.user);
      const { appointmentId } = req.params;
      const { reason } = req.body;
      const cancelled = await service.cancelAppointment(patientId, String(appointmentId), reason);
      return res.status(200).json({
        success: true,
        message: "Appointment cancelled successfully",
        data: cancelled,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: err.message || "Failed to cancel appointment",
      });
    }
  }

  async rescheduleAppointment(req: AuthRequest, res: Response) {
    try {
      const patientId = await service.resolvePatientId(req.user);
      const { appointmentId } = req.params;
      const updated = await service.rescheduleAppointment(
        patientId,
        String(appointmentId),
        req.body,
        req.user
      );
      return res.status(200).json({
        success: true,
        message: "Appointment rescheduled successfully",
        data: updated,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: err.message || "Failed to reschedule appointment",
      });
    }
  }
}
