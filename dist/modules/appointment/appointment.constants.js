"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAY_OF_WEEK_NAMES = exports.NON_BLOCKING_APPOINTMENT_STATUSES = exports.TERMINAL_APPOINTMENT_STATUSES = exports.APPOINTMENT_STATUS_VALUES = exports.APPOINTMENT_STATUS = void 0;
exports.APPOINTMENT_STATUS = {
    SCHEDULED: "SCHEDULED",
    RESCHEDULED: "RESCHEDULED",
    CHECKED_IN: "CHECKED_IN",
    IN_CONSULTATION: "IN_CONSULTATION",
    COMPLETED: "COMPLETED",
    CANCELLED: "CANCELLED",
    NO_SHOW: "NO_SHOW",
    // Set automatically when a booked slot's time window passes without a
    // check-in (see appointment-status.job.ts) - the slot no longer counts
    // as booked or blocks new bookings.
    NOT_CHECKED_IN: "NOT_CHECKED_IN",
    // Set only by the doctor-transfer workflow (see modules/doctor-transfer) -
    // not reachable through the generic PATCH /:appointmentNo/status endpoint.
    TRANSFER_REVIEW_REQUIRED: "TRANSFER_REVIEW_REQUIRED",
    RESCHEDULE_REQUIRED: "RESCHEDULE_REQUIRED"
};
exports.APPOINTMENT_STATUS_VALUES = Object.values(exports.APPOINTMENT_STATUS);
// Once an appointment lands in one of these, it is closed for
// modification/rescheduling and its slot no longer blocks new bookings.
exports.TERMINAL_APPOINTMENT_STATUSES = [
    exports.APPOINTMENT_STATUS.COMPLETED,
    exports.APPOINTMENT_STATUS.CANCELLED,
    exports.APPOINTMENT_STATUS.NO_SHOW,
    exports.APPOINTMENT_STATUS.NOT_CHECKED_IN
];
exports.NON_BLOCKING_APPOINTMENT_STATUSES = [
    exports.APPOINTMENT_STATUS.CANCELLED,
    exports.APPOINTMENT_STATUS.NO_SHOW,
    exports.APPOINTMENT_STATUS.NOT_CHECKED_IN
];
exports.DAY_OF_WEEK_NAMES = [
    "SUNDAY",
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY"
];
