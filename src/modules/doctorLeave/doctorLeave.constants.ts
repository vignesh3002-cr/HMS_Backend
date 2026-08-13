export const LEAVE_STATUS = {
    PENDING: "PENDING",
    APPROVED: "APPROVED",
    REJECTED: "REJECTED"
} as const;

export const LEAVE_STATUS_VALUES = Object.values(LEAVE_STATUS);

export const LEAVE_ACTION = {
    APPLY: "APPLY",
    APPROVE: "APPROVE",
    REJECT: "REJECT"
} as const;

export const LEAVE_ACTION_VALUES = Object.values(LEAVE_ACTION);

export const LEAVE_REASON_MAX_LENGTH = 500;

export const LEAVE_REMARKS_MAX_LENGTH = 500;

export const LEAVE_DEFAULT_PAGE = 1;

export const LEAVE_DEFAULT_LIMIT = 10;

export const LEAVE_TRANSACTION_TIMEOUT_MS = 30000;

export const LEAVE_DEFAULT_APPROVAL_REMARK =
    "Leave approved";

export const LEAVE_NOTIFICATION_STATUS = {
    PENDING: "PENDING",
    SENT: "SENT",
    FAILED: "FAILED"
} as const;

export const LEAVE_NOTIFICATION_STATUS_VALUES = Object.values(
    LEAVE_NOTIFICATION_STATUS
);