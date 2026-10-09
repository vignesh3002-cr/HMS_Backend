"use strict";
// The pharmacy slip is a document of record: it is resolved once from the
// chemotherapy order and then frozen. There is no separate Issue step - printing
// the slip is what finalises it, so a DRAFT can still be edited up to that
// moment and ISSUED/CANCELLED cannot change at all. The database enforces the
// same three statuses plus the "ISSUED implies issued_at" rule via the named
// constraints in prisma/sql/20261001_pharmacy_slip.sql; the transition map below
// is the application-side mirror of that.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONSTRAINT_MESSAGES = exports.ID_ENTITY = exports.PHARMACY_DRUG_ROLE = exports.PHARMACY_SLIP_EDITABLE_STATUSES = exports.PHARMACY_SLIP_TERMINAL_STATUSES = exports.PHARMACY_SLIP_STATUS_TRANSITIONS = exports.PHARMACY_SLIP_STATUS_VALUES = exports.PHARMACY_SLIP_STATUS = void 0;
exports.PHARMACY_SLIP_STATUS = {
    DRAFT: "DRAFT",
    ISSUED: "ISSUED",
    CANCELLED: "CANCELLED"
};
exports.PHARMACY_SLIP_STATUS_VALUES = Object.values(exports.PHARMACY_SLIP_STATUS);
exports.PHARMACY_SLIP_STATUS_TRANSITIONS = {
    DRAFT: [exports.PHARMACY_SLIP_STATUS.ISSUED, exports.PHARMACY_SLIP_STATUS.CANCELLED],
    ISSUED: [exports.PHARMACY_SLIP_STATUS.CANCELLED],
    CANCELLED: []
};
exports.PHARMACY_SLIP_TERMINAL_STATUSES = [
    exports.PHARMACY_SLIP_STATUS.CANCELLED
];
// Only a DRAFT's quantity is still editable. ISSUED may still be printed again
// (which re-stamps printed_at) and CANCELLED (e.g. returned stock), but neither
// accepts quantity changes.
exports.PHARMACY_SLIP_EDITABLE_STATUSES = [
    exports.PHARMACY_SLIP_STATUS.DRAFT
];
// drug_role values a slip line can carry. The first four mirror
// chemotherapy.DRUG_ROLE; ADVICE is stamped by the consultation on the
// separate advice prescription (AdviceSection.tsx); DISCHARGE marks the
// protocol's take-home medicines.
exports.PHARMACY_DRUG_ROLE = {
    PRIMARY: "PRIMARY",
    PREMEDICATION: "PREMEDICATION",
    POSTMEDICATION: "POSTMEDICATION",
    SUPPORTIVE: "SUPPORTIVE",
    ADVICE: "ADVICE",
    DISCHARGE: "DISCHARGE"
};
exports.ID_ENTITY = {
    SLIP: "PHARMACY_SLIP",
    SLIP_ITEM: "PHARMACY_SLIP_ITEM"
};
// Database CHECK constraint -> message. A raw Prisma error carries the
// constraint name; this turns it into something a pharmacy user can act on
// instead of a 500 (same pattern as chemotherapy.controller.ts).
exports.CONSTRAINT_MESSAGES = {
    uq_pharmacy_slip_order: "A pharmacy slip already exists for this cycle day's order. Cancel it first to print a replacement.",
    chk_pharmacy_slip_status: "Invalid pharmacy slip status.",
    chk_pharmacy_slip_issued: "An issued slip must record when it was issued.",
    chk_pharmacy_slip_item_drug: "Each pharmacy slip line needs either a medicine from the catalog or a drug name."
};
