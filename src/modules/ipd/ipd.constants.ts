import {
    IPD_STATUS,
    BED_STATUS,
    WARD_STATUS,
    DAYCARE
} from "./ipd.types";

export const IPD_STATUS_VALUES: string[] = Object.values(IPD_STATUS);
export const BED_STATUS_VALUES: string[] = Object.values(BED_STATUS);
export const WARD_STATUS_VALUES: string[] = Object.values(WARD_STATUS);

export const ADMISSION_TYPE = {
    REGULAR: "REGULAR",
    DAYCARE: DAYCARE,
    EMERGENCY: "EMERGENCY",
    PLANNED: "PLANNED",
    REFERRAL: "REFERRAL",
    TRANSFER: "TRANSFER",
    OPD_TO_IPD: "OPD_TO_IPD",
    DIRECT: "DIRECT",
} as const;

export const ADMISSION_TYPE_VALUES: string[] = Object.values(ADMISSION_TYPE);

export const DISCHARGE_TYPE = {
    RECOVERED: "RECOVERED",
    AGAINST_MEDICAL_ADVICE: "AGAINST_MEDICAL_ADVICE",
    REFERRED_OUT: "REFERRED_OUT",
    DECEASED: "DECEASED",
    DAYCARE_RELEASED: "DAYCARE_RELEASED",
} as const;

export const DISCHARGE_TYPE_VALUES: string[] = Object.values(DISCHARGE_TYPE);

export const ADMISSION_DEFAULT_STATUS = IPD_STATUS.ADMITTED;

export const WARD_TYPE_DEFAULT = "GENERAL";
export const BED_TYPE_DEFAULT = "GENERAL";
export const BED_STATUS_DEFAULT = BED_STATUS.AVAILABLE;

export const PAYMENT_MODE_VALUES = [
    "CASH",
    "CARD",
    "UPI",
    "INSURANCE",
    "COMPANY_BILL"
] as const;

export const BED_TYPE_VALUES = [
    "GENERAL",
    "SEMI_PRIVATE",
    "PRIVATE",
    "ICU",
    "CCU",
    "ISOLATION"
] as const;

export const WARD_TYPE_VALUES = [
    "GENERAL",
    "SEMI_PRIVATE",
    "PRIVATE",
    "ICU",
    "CCU",
    "ISOLATION",
    "DAYCARE"
] as const;

export const IDGeneratorGated = {
    ADMISSION: "ADMISSION",
    WARD: "WARD",
    BED: "BED",
    ADMISSION_TRANSFER: "ADMISSION_TRANSFER",
    ADMISSION_TRANSFER_LOG: "ADMISSION_TRANSFER_LOG",
} as const;

