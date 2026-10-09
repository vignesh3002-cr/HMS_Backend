// The pharmacy slip is a document of record: it is resolved once from the
// chemotherapy order and then frozen. There is no separate Issue step - printing
// the slip is what finalises it, so a DRAFT can still be edited up to that
// moment and ISSUED/CANCELLED cannot change at all. The database enforces the
// same three statuses plus the "ISSUED implies issued_at" rule via the named
// constraints in prisma/sql/20261001_pharmacy_slip.sql; the transition map below
// is the application-side mirror of that.

export const PHARMACY_SLIP_STATUS = {
    DRAFT: "DRAFT",
    ISSUED: "ISSUED",
    CANCELLED: "CANCELLED"
} as const;

export type PharmacySlipStatus = typeof PHARMACY_SLIP_STATUS[keyof typeof PHARMACY_SLIP_STATUS];

export const PHARMACY_SLIP_STATUS_VALUES: string[] = Object.values(PHARMACY_SLIP_STATUS);

export const PHARMACY_SLIP_STATUS_TRANSITIONS: Record<PharmacySlipStatus, PharmacySlipStatus[]> = {
    DRAFT: [PHARMACY_SLIP_STATUS.ISSUED, PHARMACY_SLIP_STATUS.CANCELLED],
    ISSUED: [PHARMACY_SLIP_STATUS.CANCELLED],
    CANCELLED: []
};

export const PHARMACY_SLIP_TERMINAL_STATUSES: PharmacySlipStatus[] = [
    PHARMACY_SLIP_STATUS.CANCELLED
];

// Only a DRAFT's quantity is still editable. ISSUED may still be printed again
// (which re-stamps printed_at) and CANCELLED (e.g. returned stock), but neither
// accepts quantity changes.
export const PHARMACY_SLIP_EDITABLE_STATUSES: PharmacySlipStatus[] = [
    PHARMACY_SLIP_STATUS.DRAFT
];

// drug_role values a slip line can carry. The first four mirror
// chemotherapy.DRUG_ROLE; ADVICE is stamped by the consultation on the
// separate advice prescription (AdviceSection.tsx); DISCHARGE marks the
// protocol's take-home medicines.
export const PHARMACY_DRUG_ROLE = {
    PRIMARY: "PRIMARY",
    PREMEDICATION: "PREMEDICATION",
    POSTMEDICATION: "POSTMEDICATION",
    SUPPORTIVE: "SUPPORTIVE",
    ADVICE: "ADVICE",
    DISCHARGE: "DISCHARGE"
} as const;

export const ID_ENTITY = {
    SLIP: "PHARMACY_SLIP",
    SLIP_ITEM: "PHARMACY_SLIP_ITEM"
} as const;

// Database CHECK constraint -> message. A raw Prisma error carries the
// constraint name; this turns it into something a pharmacy user can act on
// instead of a 500 (same pattern as chemotherapy.controller.ts).
export const CONSTRAINT_MESSAGES: Record<string, string> = {
    uq_pharmacy_slip_order: "A pharmacy slip already exists for this cycle day's order. Cancel it first to print a replacement.",
    chk_pharmacy_slip_status: "Invalid pharmacy slip status.",
    chk_pharmacy_slip_issued: "An issued slip must record when it was issued.",
    chk_pharmacy_slip_item_drug: "Each pharmacy slip line needs either a medicine from the catalog or a drug name."
};