"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOT_CHECKED_IN_JOB_INTERVAL_MS = void 0;
exports.transitionElapsedAppointments = transitionElapsedAppointments;
exports.startAppointmentStatusJob = startAppointmentStatusJob;
exports.stopAppointmentStatusJob = stopAppointmentStatusJob;
const prisma_1 = __importDefault(require("../../config/prisma"));
const appointment_constants_1 = require("./appointment.constants");
const DEFAULT_CONSULTATION_MINUTES = 20;
exports.NOT_CHECKED_IN_JOB_INTERVAL_MS = 5 * 60 * 1000;
// appointment_date is stored as UTC midnight of the wall-clock date and
// appointment_time as UTC time-of-day (see appointment.utils.ts), so the
// wall-clock instant is built from the UTC parts and compared against the
// server's current local time - the same interpretation the client uses in
// lib/appointmentStatus.ts.
function appointmentEndMs(appointment) {
    const date = appointment.appointment_date;
    const time = appointment.appointment_time;
    const minutes = appointment.consultation_minutes ?? DEFAULT_CONSULTATION_MINUTES;
    return (new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), time.getUTCHours(), time.getUTCMinutes(), time.getUTCSeconds()).getTime() + minutes * 60000);
}
// Any SCHEDULED/RESCHEDULED appointment whose consultation window has fully
// elapsed without a check-in becomes NOT_CHECKED_IN: the status is terminal
// and non-blocking, so it stops counting as booked and frees its slot.
async function transitionElapsedAppointments() {
    const now = new Date();
    const todayUtcMidnight = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const candidates = await prisma_1.default.appointment_history.findMany({
        where: {
            status: {
                in: [appointment_constants_1.APPOINTMENT_STATUS.SCHEDULED, appointment_constants_1.APPOINTMENT_STATUS.RESCHEDULED]
            },
            appointment_date: { lte: todayUtcMidnight }
        },
        select: {
            appointment_id: true,
            appointment_date: true,
            appointment_time: true,
            doctor_schedule: { select: { consultation_minutes: true } }
        }
    });
    const elapsedIds = candidates
        .filter((appointment) => appointmentEndMs(appointment) <= now.getTime())
        .map((appointment) => appointment.appointment_id);
    if (elapsedIds.length === 0) {
        return 0;
    }
    const result = await prisma_1.default.appointment_history.updateMany({
        where: { appointment_id: { in: elapsedIds } },
        data: { status: appointment_constants_1.APPOINTMENT_STATUS.NOT_CHECKED_IN }
    });
    return result.count;
}
let intervalHandle = null;
// Runs once at startup and then on a fixed interval. Safe to call multiple
// times - only one timer is ever kept.
function startAppointmentStatusJob() {
    if (intervalHandle) {
        return;
    }
    void transitionElapsedAppointments().catch((error) => {
        console.error("[appointment-status.job] initial run failed:", error);
    });
    intervalHandle = setInterval(() => {
        void transitionElapsedAppointments().catch((error) => {
            console.error("[appointment-status.job] run failed:", error);
        });
    }, exports.NOT_CHECKED_IN_JOB_INTERVAL_MS);
    // Never keep the process alive just for this timer.
    intervalHandle.unref();
}
function stopAppointmentStatusJob() {
    if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
    }
}
