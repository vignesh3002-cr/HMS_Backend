"use strict";
// Shared types for the TNM staging module.
//
// The master tables are seeded from EMR_Master_IHC_Genomics_TNM.xlsx; these
// types describe the rows the derivation engine consumes, so the same code
// works for database rows, seeded JSON (verify script) and the HTTP layer.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONTEXT_LABEL = exports.CONTEXT_PREFIX = exports.CONTEXT_FAMILY = exports.CONTEXT_VALUES = void 0;
exports.CONTEXT_VALUES = [
    "CLINICAL",
    "PATHOLOGICAL",
    "YP",
    "RECURRENCE"
];
exports.CONTEXT_FAMILY = {
    CLINICAL: "clinical",
    PATHOLOGICAL: "pathological",
    YC: "clinical",
    YP: "pathological",
    RECURRENCE: "clinical",
    AUTOPSY: "pathological",
};
// Short prefix shown next to a stage: cT2 / pT2 / ycT2 / ypT2 / rT2 / aT2.
exports.CONTEXT_PREFIX = {
    CLINICAL: "c",
    PATHOLOGICAL: "p",
    YC: "yc",
    YP: "yp",
    RECURRENCE: "r",
    AUTOPSY: "a",
};
exports.CONTEXT_LABEL = {
    CLINICAL: "Clinical",
    PATHOLOGICAL: "Pathological",
    YC: "Post-neoadjuvant clinical",
    YP: "Post-neoadjuvant pathological",
    RECURRENCE: "Recurrence",
    AUTOPSY: "Autopsy",
};
