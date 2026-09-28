"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IDGeneratorGated = exports.WARD_TYPE_VALUES = exports.BED_TYPE_VALUES = exports.PAYMENT_MODE_VALUES = exports.BED_STATUS_DEFAULT = exports.BED_TYPE_DEFAULT = exports.WARD_TYPE_DEFAULT = exports.ADMISSION_DEFAULT_STATUS = exports.DISCHARGE_TYPE_VALUES = exports.DISCHARGE_TYPE = exports.ADMISSION_TYPE_VALUES = exports.ADMISSION_TYPE = exports.WARD_STATUS_VALUES = exports.BED_STATUS_VALUES = exports.IPD_STATUS_VALUES = void 0;
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
exports.ADMISSION_DEFAULT_STATUS = ipd_types_1.IPD_STATUS.ADMITTED;
exports.WARD_TYPE_DEFAULT = "GENERAL";
exports.BED_TYPE_DEFAULT = "GENERAL";
exports.BED_STATUS_DEFAULT = ipd_types_1.BED_STATUS.AVAILABLE;
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
