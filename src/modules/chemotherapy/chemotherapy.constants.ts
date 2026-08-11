// None of the chemotherapy_* tables have DB-level CHECK constraints on their
// status columns (verified directly against the live schema, unlike the
// oncology tables which are heavily constrained) - so these enums and the
// transition maps below are the only place these lifecycle rules are
// enforced. Every table also carries deleted_flag/active_status, matching
// the soft-delete convention used everywhere else in this codebase (doctor
// schedules, appointments) - nothing here is ever hard-deleted.

export const PLAN_STATUS = {
    PLANNED: "PLANNED",
    ACTIVE: "ACTIVE",
    COMPLETED: "COMPLETED",
    DISCONTINUED: "DISCONTINUED",
    CANCELLED: "CANCELLED"
} as const;

export type PlanStatus = typeof PLAN_STATUS[keyof typeof PLAN_STATUS];

// A plan starts PLANNED and only ever moves forward. ACTIVE is entered
// automatically the moment the first cycle is started (see
// chemotherapy.service.ts) - it's not a manual action. COMPLETED/
// DISCONTINUED/CANCELLED are terminal: no further cycles, edits, or status
// changes once reached.
export const PLAN_STATUS_TRANSITIONS: Record<PlanStatus, PlanStatus[]> = {
    PLANNED: [PLAN_STATUS.ACTIVE, PLAN_STATUS.CANCELLED],
    ACTIVE: [PLAN_STATUS.COMPLETED, PLAN_STATUS.DISCONTINUED],
    COMPLETED: [],
    DISCONTINUED: [],
    CANCELLED: []
};

export const PLAN_TERMINAL_STATUSES: PlanStatus[] = [
    PLAN_STATUS.COMPLETED, PLAN_STATUS.DISCONTINUED, PLAN_STATUS.CANCELLED
];

export const CYCLE_STATUS = {
    PLANNED: "PLANNED",
    APPROVED: "APPROVED",
    IN_PROGRESS: "IN_PROGRESS",
    COMPLETED: "COMPLETED",
    DELAYED: "DELAYED",
    CANCELLED: "CANCELLED"
} as const;

export type CycleStatus = typeof CYCLE_STATUS[keyof typeof CYCLE_STATUS];

// A cycle needs physician_approved before the first drug can be
// administered (mirrors the design guide's requirement that a doctor signs
// off each cycle, not just the overall plan). Administering the first drug
// moves it PLANNED/APPROVED/DELAYED -> IN_PROGRESS automatically. COMPLETED
// and CANCELLED are terminal.
export const CYCLE_STATUS_TRANSITIONS: Record<CycleStatus, CycleStatus[]> = {
    PLANNED: [CYCLE_STATUS.APPROVED, CYCLE_STATUS.DELAYED, CYCLE_STATUS.CANCELLED],
    APPROVED: [CYCLE_STATUS.IN_PROGRESS, CYCLE_STATUS.DELAYED, CYCLE_STATUS.CANCELLED],
    IN_PROGRESS: [CYCLE_STATUS.COMPLETED, CYCLE_STATUS.CANCELLED],
    DELAYED: [CYCLE_STATUS.APPROVED, CYCLE_STATUS.CANCELLED],
    COMPLETED: [],
    CANCELLED: []
};

export const CYCLE_TERMINAL_STATUSES: CycleStatus[] = [CYCLE_STATUS.COMPLETED, CYCLE_STATUS.CANCELLED];

export const CYCLE_ADMINISTRABLE_STATUSES: CycleStatus[] = [
    CYCLE_STATUS.APPROVED, CYCLE_STATUS.IN_PROGRESS
];

// V-05/V-06-style hard gate for plan creation, per the client's explicit
// "never auto-treat" requirement: a plan can only be created once a
// suggested_therapy has actually been computed for the staging detail AND
// the requesting clinician has explicitly confirmed it - confirmation is
// the human decision point, never inferred or defaulted.
export const PLAN_CONFIRMATION_RULE = "PLAN-01";

export const DRUG_ROLE = {
    PRIMARY: "PRIMARY",
    PREMEDICATION: "PREMEDICATION",
    POSTMEDICATION: "POSTMEDICATION",
    SUPPORTIVE: "SUPPORTIVE"
} as const;

export const ID_ENTITY = {
    PLAN: "CHEMOTHERAPY_PLAN",
    PLAN_ITEM: "CHEMOTHERAPY_PLAN_ITEM",
    CYCLE: "CHEMOTHERAPY_CYCLE",
    ADMINISTRATION: "CHEMOTHERAPY_ADMINISTRATION",
    ADVERSE_EVENT: "CHEMOTHERAPY_ADVERSE_EVENT",
    VITALS: "CHEMOTHERAPY_VITALS",
    LAB_REVIEW: "CHEMOTHERAPY_LAB_REVIEW",
    FOLLOWUP: "CHEMOTHERAPY_FOLLOWUP",
    REGIMEN_PROTOCOL: "REGIMEN_PROTOCOL",
    REGIMEN_PROTOCOL_ITEM: "REGIMEN_PROTOCOL_ITEM"
} as const;
