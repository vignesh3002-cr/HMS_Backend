export const APPOINTMENT_STATUS = {
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
} as const;

export const APPOINTMENT_STATUS_VALUES: string[] =
    Object.values(APPOINTMENT_STATUS);

// Once an appointment lands in one of these, it is closed for
// modification/rescheduling and its slot no longer blocks new bookings.
export const TERMINAL_APPOINTMENT_STATUSES: string[] = [
    APPOINTMENT_STATUS.COMPLETED,
    APPOINTMENT_STATUS.CANCELLED,
    APPOINTMENT_STATUS.NO_SHOW,
    APPOINTMENT_STATUS.NOT_CHECKED_IN
];

export const NON_BLOCKING_APPOINTMENT_STATUSES: string[] = [
    APPOINTMENT_STATUS.CANCELLED,
    APPOINTMENT_STATUS.NO_SHOW,
    APPOINTMENT_STATUS.NOT_CHECKED_IN
];

export const DAY_OF_WEEK_NAMES = [
    "SUNDAY",
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY"
];
