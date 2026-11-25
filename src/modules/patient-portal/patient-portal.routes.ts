import { Router } from "express";
import { authenticate } from "../auth/auth.middleware";
import { PatientPortalController } from "./patient-portal.controller";

const router = Router();
const controller = new PatientPortalController();

// All routes require authentication (either role=PATIENT or admin/doctor viewing patient portal)
router.get("/dashboard", authenticate, controller.getDashboard.bind(controller));
router.get("/appointments", authenticate, controller.getAppointments.bind(controller));
router.post("/appointments", authenticate, controller.bookAppointment.bind(controller));
router.post("/appointments/:appointmentId/cancel", authenticate, controller.cancelAppointment.bind(controller));
router.post("/appointments/:appointmentId/reschedule", authenticate, controller.rescheduleAppointment.bind(controller));
router.put("/appointments/:appointmentId/reschedule", authenticate, controller.rescheduleAppointment.bind(controller));
router.get("/branches", authenticate, controller.getBranches.bind(controller));
router.get("/departments", authenticate, controller.getDepartments.bind(controller));
router.get("/doctors", authenticate, controller.getDoctors.bind(controller));
router.get("/available-slots", authenticate, controller.getAvailableSlots.bind(controller));
router.get("/lab-reports", authenticate, controller.getLabReports.bind(controller));
router.get("/prescriptions", authenticate, controller.getPrescriptions.bind(controller));
router.get("/vitals", authenticate, controller.getVitalsHistory.bind(controller));
router.get("/allergies", authenticate, controller.getAllergies.bind(controller));
router.get("/chemotherapy", authenticate, controller.getChemotherapyPlans.bind(controller));

export default router;
