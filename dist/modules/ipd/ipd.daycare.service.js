"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DaycareService = void 0;
const appointment_service_1 = require("../appointment/appointment.service");
const ipd_service_1 = require("./ipd.service");
/*
 * Daycare booking = the doctor's OPD slot + a PLANNED daycare admission,
 * linked by admission.appointment_id. Lives in its own file because the
 * appointment module already imports IpdService (for cancel / no-show
 * cascades), so IpdService itself can't import AppointmentService back.
 *
 * Order matters for capacity: the daycare request is created first, under
 * the ward lock, so the place is taken before the slot is booked. If the
 * slot can't be booked the request is discarded again, so nothing half-made
 * is ever left behind.
 */
class DaycareService {
    ipd;
    appointments;
    constructor(ipd = new ipd_service_1.IpdService(), appointments = new appointment_service_1.AppointmentService()) {
        this.ipd = ipd;
        this.appointments = appointments;
    }
    async book(data, actor) {
        const admissionId = await this.ipd.createDaycareRequest(data, actor);
        let appointmentId;
        try {
            const appointment = await this.appointments.bookAppointment({
                patient_id: data.patient_id,
                employee_id: data.employee_id,
                branch_id: data.branch_id,
                department_id: data.department_id,
                appointment_date: data.appointment_date,
                appointment_time: data.appointment_time,
                reason_for_visit: data.reason_for_visit?.trim() || "Daycare",
                patient_type: "Inpatient (IPD)",
                patient_visit_type: "Daycare",
            }, actor.user_id);
            appointmentId = appointment.appointment_id;
        }
        catch (error) {
            await this.ipd.discardDaycareRequest(admissionId).catch(() => undefined);
            throw error;
        }
        try {
            await this.ipd.linkDaycareAppointment(admissionId, appointmentId);
        }
        catch (error) {
            await this.appointments
                .cancelAppointment(appointmentId, "Daycare booking could not be completed", actor.user_id)
                .catch(() => undefined);
            await this.ipd.discardDaycareRequest(admissionId).catch(() => undefined);
            throw error;
        }
        return this.ipd.getAdmissionByIpNumber(admissionId);
    }
}
exports.DaycareService = DaycareService;
