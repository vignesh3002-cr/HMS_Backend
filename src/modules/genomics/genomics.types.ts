import {
    GenomicSampleType,
    GenomicScope,
    GenomicStatus,
} from "./genomics.constants";

export interface GenomicResultInput {
    geneSymbol: string;
    isOtherGene?: boolean;
    status: GenomicStatus | string;
    transcriptDetails?: string | null;
}

export interface GenomicTestInput {
    sampleType: GenomicSampleType | string;
    cancerSite: string;
    reportDate: string;
    collectionDate?: string | null;
    labName?: string | null;
    panelName?: string | null;
    reportDocumentId?: string | null;
    remarks?: string | null;
    results: GenomicResultInput[];
    /** Optional context - the visit and diagnosis the report belongs to. */
    encounterNo?: string | null;
    stagingDetailId?: string | null;
}

export interface GenomicFieldError {
    field: string;
    message: string;
}

export interface GenomicResultRecord {
    result_id: string;
    test_id: string;
    gene_symbol: string;
    is_other_gene: boolean;
    status: GenomicStatus;
    transcript_details: string | null;
}

export interface GenomicTestRecord {
    test_id: string;
    patient_id: string;
    encounter_no: string | null;
    staging_detail_id: string | null;
    branch_id: string | null;
    sample_type: GenomicSampleType;
    cancer_site: string;
    report_date: string;
    collection_date: string | null;
    lab_name: string | null;
    panel_name: string | null;
    report_document_id: string | null;
    remarks: string | null;
    is_deleted: boolean;
    delete_reason: string | null;
    created_by: string;
    created_at: string;
    updated_by: string | null;
    updated_at: string | null;
    genomic_result: GenomicResultRecord[];
}

export interface GeneMasterRecord {
    gene_master_id: string;
    cancer_site: string;
    scope: GenomicScope;
    gene_symbol: string;
    sort_order: number;
    active: boolean;
    source: string | null;
    spec_site: string | null;
}

export interface KeyAlteration {
    gene_symbol: string;
    status: GenomicStatus;
    sample_type: GenomicSampleType;
    report_date: string;
    test_id: string;
    cancer_site: string;
}
