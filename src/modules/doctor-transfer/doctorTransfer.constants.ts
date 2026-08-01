export const TRANSFER_STATUS = {
    PENDING_CONFIRMATION: "PENDING_CONFIRMATION",
    COMPLETED: "COMPLETED"
} as const;

export const TRANSFER_ACTION = {
    TRANSFER: "TRANSFER",
    RESCHEDULE: "RESCHEDULE",
    CANCEL: "CANCEL"
} as const;

export const TRANSFER_ACTION_VALUES: string[] = Object.values(TRANSFER_ACTION);

export const APPOINTMENT_LOG_RESULT = {
    SUCCESS: "SUCCESS",
    CONFLICT: "CONFLICT",
    QUEUED: "QUEUED",
    CANCELLED: "CANCELLED"
} as const;

export const RESCHEDULE_QUEUE_STATUS = {
    PENDING: "PENDING",
    ASSIGNED: "ASSIGNED",
    CONFIRMED: "CONFIRMED",
    CANCELLED: "CANCELLED"
} as const;

export const RESCHEDULE_QUEUE_ACTION = {
    CREATED: "CREATED",
    ASSIGNED: "ASSIGNED",
    CONFIRMED: "CONFIRMED",
    CANCELLED: "CANCELLED"
} as const;

export const RESCHEDULE_ACTION_INPUT = {
    ASSIGN: "ASSIGN",
    CONFIRM: "CONFIRM",
    CANCEL: "CANCEL"
} as const;

export const RESCHEDULE_ACTION_INPUT_VALUES: string[] = Object.values(RESCHEDULE_ACTION_INPUT);

export const NOTIFICATION_CHANNEL_VALUES: string[] = ["SMS", "EMAIL", "WHATSAPP"];

export const DOCTOR_TRANSFER_CANCEL_REASON = "DOCTOR_TRANSFER";

// A doctor-transfer confirmation loops per affected appointment inside one
// transaction, which can exceed Prisma's 5s interactive-transaction default
// once a doctor's future backlog runs into the hundreds.
export const TRANSFER_TRANSACTION_TIMEOUT_MS = 30000;
