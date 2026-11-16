export const APPOINTMENT_STATUS = {
    SCHEDULED: "SCHEDULED",
    RESCHEDULED: "RESCHEDULED",
    CHECKED_IN: "CHECKED_IN",
    IN_CONSULTATION: "IN_CONSULTATION",
    COMPLETED: "COMPLETED",
    CANCELLED: "CANCELLED",
    NO_SHOW: "NO_SHOW",
    RESCHEDULE_REQUIRED: "RESCHEDULE_REQUIRED"
} as const;

export const APPOINTMENT_STATUS_VALUES: string[] =
    Object.values(APPOINTMENT_STATUS);

// Once an appointment lands in one of these, it is closed for
// modification/rescheduling and its slot no longer blocks new bookings.
export const TERMINAL_APPOINTMENT_STATUSES: string[] = [
    APPOINTMENT_STATUS.COMPLETED,
    APPOINTMENT_STATUS.CANCELLED,
    APPOINTMENT_STATUS.NO_SHOW
];

export const NON_BLOCKING_APPOINTMENT_STATUSES: string[] = [
    APPOINTMENT_STATUS.CANCELLED,
    APPOINTMENT_STATUS.NO_SHOW
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

export const DEFAULT_VISIT_DURATIONS: Record<string, number> = {
    "New consultation": 40,
    "Follow-up": 10,
    "Lab Visit": 10,
    "Chemotherapy Visit": 10,
    "New Complaints": 10,
    "Others": 10
};
