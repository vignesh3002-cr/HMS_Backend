"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IDGeneratorGated = exports.WARD_TYPE_VALUES = exports.BED_TYPE_VALUES = exports.PAYMENT_MODE_VALUES = exports.IST_OFFSET_MS = exports.RESERVATION_MAX_DAYS_AHEAD = exports.MANUAL_BED_STATUSES = exports.BED_STATUS_DEFAULT = exports.BED_TYPE_DEFAULT = exports.WARD_TYPE_DEFAULT = exports.ADMISSION_DEFAULT_STATUS = exports.PATIENT_STATUS_AT_DISCHARGE_VALUES = exports.PATIENT_STATUS_AT_DISCHARGE = exports.DISCHARGE_TYPE_VALUES = exports.DISCHARGE_TYPE = exports.ADMISSION_TYPE_VALUES = exports.ADMISSION_TYPE = exports.WARD_STATUS_VALUES = exports.BED_STATUS_VALUES = exports.IPD_STATUS_VALUES = void 0;
const ipd_types_1 = require("./ipd.types");
exports.IPD_STATUS_VALUES = Object.values(ipd_types_1.IPD_STATUS);
exports.BED_STATUS_VALUES = Object.values(ipd_types_1.BED_STATUS);
exports.WARD_STATUS_VALUES = Object.values(ipd_types_1.WARD_STATUS);
exports.ADMISSION_TYPE = {
    REGULAR: "REGULAR",
    DAYCARE: ipd_types_1.DAYCARE,
    EMERGENCY: "EMERGENCY",
    PLANNED: "PLANNED",
    REFERRAL: "REFERRAL",
    TRANSFER: "TRANSFER",
    OPD_TO_IPD: "OPD_TO_IPD",
    DIRECT: "DIRECT",
};
exports.ADMISSION_TYPE_VALUES = Object.values(exports.ADMISSION_TYPE);
exports.DISCHARGE_TYPE = {
    RECOVERED: "RECOVERED",
    AGAINST_MEDICAL_ADVICE: "AGAINST_MEDICAL_ADVICE",
    REFERRED_OUT: "REFERRED_OUT",
    DECEASED: "DECEASED",
    DAYCARE_RELEASED: "DAYCARE_RELEASED",
};
exports.DISCHARGE_TYPE_VALUES = Object.values(exports.DISCHARGE_TYPE);
// The patient's clinical condition at the moment of discharge -- distinct
// from discharge_type (why they're leaving). DECEASED is never picked
// manually: it's forced automatically when discharge_type is DECEASED (see
// IpdService.dischargeAdmission).
exports.PATIENT_STATUS_AT_DISCHARGE = {
    STABLE: "STABLE",
    IMPROVED: "IMPROVED",
    UNCHANGED: "UNCHANGED",
    DETERIORATED: "DETERIORATED",
    CRITICAL: "CRITICAL",
    DECEASED: "DECEASED",
};
exports.PATIENT_STATUS_AT_DISCHARGE_VALUES = Object.values(exports.PATIENT_STATUS_AT_DISCHARGE);
exports.ADMISSION_DEFAULT_STATUS = ipd_types_1.IPD_STATUS.ADMITTED;
exports.WARD_TYPE_DEFAULT = "GENERAL";
exports.BED_TYPE_DEFAULT = "GENERAL";
exports.BED_STATUS_DEFAULT = ipd_types_1.BED_STATUS.AVAILABLE;
// Statuses staff can set by hand. RESERVED and OCCUPIED only ever come from
// the reserve / admit / transfer / discharge flows.
exports.MANUAL_BED_STATUSES = [
    ipd_types_1.BED_STATUS.AVAILABLE,
    ipd_types_1.BED_STATUS.CLEANING,
    ipd_types_1.BED_STATUS.MAINTENANCE,
];
// A bed can be reserved for a planned admission dated at most this many days
// ahead (0 = today only, 1 = today or tomorrow). The reservation lapses at the
// end of the planned day (IST).
//
// The nightly pg_cron sweep (prisma/sql/20261007_daily_sweeps_pg_cron.sql)
// releases lapsed reservations and turns PLANNED admissions whose planned
// day has passed into NO_SHOW.
exports.RESERVATION_MAX_DAYS_AHEAD = 1;
// The hospital runs on IST (UTC+05:30, no DST) -- same fixed offset as the
// appointment job, so day boundaries don't depend on the server timezone.
exports.IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
exports.PAYMENT_MODE_VALUES = [
    "CASH",
    "CARD",
    "UPI",
    "INSURANCE",
    "COMPANY_BILL"
];
exports.BED_TYPE_VALUES = [
    "GENERAL",
    "SEMI_PRIVATE",
    "PRIVATE",
    "ICU",
    "CCU",
    "ISOLATION"
];
exports.WARD_TYPE_VALUES = [
    "GENERAL",
    "SEMI_PRIVATE",
    "PRIVATE",
    "ICU",
    "CCU",
    "ISOLATION",
    "DAYCARE"
];
exports.IDGeneratorGated = {
    ADMISSION: "ADMISSION",
    WARD: "WARD",
    BED: "BED",
    ADMISSION_TRANSFER: "ADMISSION_TRANSFER",
    ADMISSION_TRANSFER_LOG: "ADMISSION_TRANSFER_LOG",
};
