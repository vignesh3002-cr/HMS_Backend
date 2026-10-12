// Free-text taxonomy for patient_document.document_type -- validated here at
// the app layer, the same way category already is (no DB CHECK constraint,
// consistent with every other classification column in this schema).
export const DOCUMENT_TYPE = {
  BIOPSY_REPORT: "BIOPSY_REPORT",
  DISCHARGE_DOCUMENT: "DISCHARGE_DOCUMENT",
  LAB_REPORT: "LAB_REPORT",
  IMAGING: "IMAGING",
  CONSENT_FORM: "CONSENT_FORM",
  INSURANCE: "INSURANCE",
  OTHER: "OTHER",
} as const;

export const DOCUMENT_TYPE_VALUES: string[] = Object.values(DOCUMENT_TYPE);
