"use strict";
// None of the chemotherapy_* tables have DB-level CHECK constraints on their
// status columns (verified directly against the live schema, unlike the
// oncology tables which are heavily constrained) - so these enums and the
// transition maps below are the only place these lifecycle rules are
// enforced. Every table also carries deleted_flag/active_status, matching
// the soft-delete convention used everywhere else in this codebase (doctor
// schedules, appointments) - nothing here is ever hard-deleted.
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROTOCOL_ACTIVE_STATUS = exports.PROTOCOL_TYPE = exports.ID_ENTITY = exports.DRUG_ROLE = exports.PLAN_CONFIRMATION_RULE = exports.CYCLE_ADMINISTRABLE_STATUSES = exports.CYCLE_TERMINAL_STATUSES = exports.CYCLE_STATUS_TRANSITIONS = exports.CYCLE_STATUS = exports.PLAN_TERMINAL_STATUSES = exports.PLAN_STATUS_TRANSITIONS = exports.PLAN_STATUS = void 0;
exports.PLAN_STATUS = {
    PLANNED: "PLANNED",
    ACTIVE: "ACTIVE",
    COMPLETED: "COMPLETED",
    DISCONTINUED: "DISCONTINUED",
    CANCELLED: "CANCELLED"
};
// A plan starts PLANNED and only ever moves forward. ACTIVE is entered
// automatically the moment the first cycle is started (see
// chemotherapy.service.ts) - it's not a manual action. COMPLETED/
// DISCONTINUED/CANCELLED are terminal: no further cycles, edits, or status
// changes once reached.
exports.PLAN_STATUS_TRANSITIONS = {
    PLANNED: [exports.PLAN_STATUS.ACTIVE, exports.PLAN_STATUS.CANCELLED],
    ACTIVE: [exports.PLAN_STATUS.COMPLETED, exports.PLAN_STATUS.DISCONTINUED],
    COMPLETED: [],
    DISCONTINUED: [],
    CANCELLED: []
};
exports.PLAN_TERMINAL_STATUSES = [
    exports.PLAN_STATUS.COMPLETED, exports.PLAN_STATUS.DISCONTINUED, exports.PLAN_STATUS.CANCELLED
];
exports.CYCLE_STATUS = {
    PLANNED: "PLANNED",
    APPROVED: "APPROVED",
    IN_PROGRESS: "IN_PROGRESS",
    COMPLETED: "COMPLETED",
    DELAYED: "DELAYED",
    CANCELLED: "CANCELLED"
};
// A cycle needs physician_approved before the first drug can be
// administered (mirrors the design guide's requirement that a doctor signs
// off each cycle, not just the overall plan). Administering the first drug
// moves it PLANNED/APPROVED/DELAYED -> IN_PROGRESS automatically. COMPLETED
// and CANCELLED are terminal.
exports.CYCLE_STATUS_TRANSITIONS = {
    PLANNED: [exports.CYCLE_STATUS.APPROVED, exports.CYCLE_STATUS.DELAYED, exports.CYCLE_STATUS.CANCELLED],
    APPROVED: [exports.CYCLE_STATUS.IN_PROGRESS, exports.CYCLE_STATUS.DELAYED, exports.CYCLE_STATUS.CANCELLED],
    IN_PROGRESS: [exports.CYCLE_STATUS.COMPLETED, exports.CYCLE_STATUS.CANCELLED],
    DELAYED: [exports.CYCLE_STATUS.APPROVED, exports.CYCLE_STATUS.CANCELLED],
    COMPLETED: [],
    CANCELLED: []
};
exports.CYCLE_TERMINAL_STATUSES = [exports.CYCLE_STATUS.COMPLETED, exports.CYCLE_STATUS.CANCELLED];
exports.CYCLE_ADMINISTRABLE_STATUSES = [
    exports.CYCLE_STATUS.APPROVED, exports.CYCLE_STATUS.IN_PROGRESS
];
// V-05/V-06-style hard gate for plan creation, per the client's explicit
// "never auto-treat" requirement: a plan can only be created once a
// suggested_therapy has actually been computed for the staging detail AND
// the requesting clinician has explicitly confirmed it - confirmation is
// the human decision point, never inferred or defaulted.
exports.PLAN_CONFIRMATION_RULE = "PLAN-01";
exports.DRUG_ROLE = {
    PRIMARY: "PRIMARY",
    PREMEDICATION: "PREMEDICATION",
    POSTMEDICATION: "POSTMEDICATION",
    SUPPORTIVE: "SUPPORTIVE"
};
exports.ID_ENTITY = {
    PLAN: "CHEMOTHERAPY_PLAN",
    PLAN_ITEM: "CHEMOTHERAPY_PLAN_ITEM",
    CYCLE: "CHEMOTHERAPY_CYCLE",
    ADMINISTRATION: "CHEMOTHERAPY_ADMINISTRATION",
    ADVERSE_EVENT: "CHEMOTHERAPY_ADVERSE_EVENT",
    VITALS: "CHEMOTHERAPY_VITALS",
    LAB_REVIEW: "CHEMOTHERAPY_LAB_REVIEW",
    FOLLOWUP: "CHEMOTHERAPY_FOLLOWUP",
    REGIMEN_PROTOCOL: "REGIMEN_PROTOCOL",
    REGIMEN_PROTOCOL_ITEM: "REGIMEN_PROTOCOL_ITEM",
    REGIMEN_PROTOCOL_DAY: "REGIMEN_PROTOCOL_DAY",
    REGIMEN_PROTOCOL_DILUTION: "REGIMEN_PROTOCOL_DILUTION",
    DISCHARGE_INSTRUCTION: "DISCHARGE_INSTRUCTION"
};
// Generic protocols are shared reference templates available to every
// organization. Personalizing one creates an independent organization-owned
// copy (protocol_type = PERSONALIZED, organization_id set) that the owning
// organization may customize without ever touching the generic source.
exports.PROTOCOL_TYPE = {
    GENERIC: "GENERIC",
    PERSONALIZED: "PERSONALIZED"
};
// chemotherapy_regimen_protocol.active_status follows the same 1/0 smallint
// convention used everywhere else: 1 = active/published (selectable for
// treatment plans), 0 = inactive/draft/deactivated (not selectable).
// A freshly personalized protocol is created with active_status = 0 and only
// becomes selectable after an explicit activate/publish operation.
exports.PROTOCOL_ACTIVE_STATUS = {
    ACTIVE: 1,
    INACTIVE: 0
};
