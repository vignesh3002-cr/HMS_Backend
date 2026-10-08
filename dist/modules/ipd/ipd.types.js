"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAYCARE = exports.WARD_STATUS = exports.BED_STATUS = exports.IPD_STATUS = void 0;
exports.IPD_STATUS = {
    PLANNED: "PLANNED",
    ADMITTED: "ADMITTED",
    DISCHARGED: "DISCHARGED",
    TRANSFERRED: "TRANSFERRED",
    CANCELLED: "CANCELLED",
    // A planned request that was never admitted (marked by staff, or by the
    // IPD bed job once the planned day plus a grace day has passed).
    NO_SHOW: "NO_SHOW",
};
// AVAILABLE -> RESERVED (held for one planned admission, expires) -> OCCUPIED
// -> CLEANING (after discharge / transfer-out) -> AVAILABLE. MAINTENANCE takes
// a bed out of service.
exports.BED_STATUS = {
    AVAILABLE: "AVAILABLE",
    RESERVED: "RESERVED",
    OCCUPIED: "OCCUPIED",
    CLEANING: "CLEANING",
    MAINTENANCE: "MAINTENANCE",
};
exports.WARD_STATUS = {
    ACTIVE: "ACTIVE",
    INACTIVE: "INACTIVE",
};
exports.DAYCARE = "Daycare";
