"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAY_OF_WEEK_NAMES = exports.NON_BLOCKING_APPOINTMENT_STATUSES = exports.TERMINAL_APPOINTMENT_STATUSES = exports.APPOINTMENT_STATUS_VALUES = exports.APPOINTMENT_STATUS = void 0;
exports.APPOINTMENT_STATUS = {
    BOOKED: "BOOKED",
    CONFIRMED: "CONFIRMED",
    CHECKED_IN: "CHECKED_IN",
    IN_CONSULTATION: "IN_CONSULTATION",
    COMPLETED: "COMPLETED",
    CANCELLED: "CANCELLED",
    NO_SHOW: "NO_SHOW"
};
exports.APPOINTMENT_STATUS_VALUES = Object.values(exports.APPOINTMENT_STATUS);
// Once an appointment lands in one of these, it is closed for
// modification/rescheduling and its slot no longer blocks new bookings.
exports.TERMINAL_APPOINTMENT_STATUSES = [
    exports.APPOINTMENT_STATUS.COMPLETED,
    exports.APPOINTMENT_STATUS.CANCELLED,
    exports.APPOINTMENT_STATUS.NO_SHOW
];
exports.NON_BLOCKING_APPOINTMENT_STATUSES = [
    exports.APPOINTMENT_STATUS.CANCELLED,
    exports.APPOINTMENT_STATUS.NO_SHOW
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
