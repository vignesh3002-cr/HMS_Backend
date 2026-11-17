// Genomic Data Capture constants. The UI shows friendly labels; the API and
// database use the enum values from the developer specification.

export const GENOMIC_SAMPLE_TYPES = ["LIQUID_BIOPSY", "TISSUE", "GERMLINE"] as const;
export type GenomicSampleType = (typeof GENOMIC_SAMPLE_TYPES)[number];

export const GENOMIC_STATUSES = ["PRESENT", "ABSENT", "VUS"] as const;
export type GenomicStatus = (typeof GENOMIC_STATUSES)[number];

export const GENOMIC_SCOPES = ["SOMATIC", "GERMLINE"] as const;
export type GenomicScope = (typeof GENOMIC_SCOPES)[number];

export const SAMPLE_TYPE_LABELS: Record<GenomicSampleType, string> = {
    LIQUID_BIOPSY: "Liquid biopsy",
    TISSUE: "Tissue",
    GERMLINE: "Germline",
};

export const STATUS_LABELS: Record<GenomicStatus, string> = {
    PRESENT: "Present",
    ABSENT: "Absent",
    VUS: "VUS",
};

// Liquid biopsy and Tissue are tumour tests -> somatic gene list.
// Germline is the inherited list.
export const SAMPLE_TYPE_TO_SCOPE: Record<GenomicSampleType, GenomicScope> = {
    LIQUID_BIOPSY: "SOMATIC",
    TISSUE: "SOMATIC",
    GERMLINE: "GERMLINE",
};

export const MAX_REMARKS_LENGTH = 1000;
export const MAX_TRANSCRIPT_LENGTH = 500;
export const MAX_LAB_NAME_LENGTH = 200;
export const MAX_PANEL_NAME_LENGTH = 200;
export const MAX_GENE_SYMBOL_LENGTH = 50;
export const MAX_DELETE_REASON_LENGTH = 500;
