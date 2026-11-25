import "dotenv/config";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Live HTTP smoke test for the Genomic Data Capture module.
// Run the backend first (npm run dev), then: npx ts-node prisma/smokeTestGenomicsHttp.ts
// It writes a real report for the patient below, then soft-deletes it, so the
// only visible side effect is an audit trail (plus the uploaded LAB_REPORT
// document if the upload step runs).

const BASE = `http://localhost:${process.env.PORT || 5000}/api`;
const SECRET = process.env.JWT_SECRET!;

const PATIENT_ID = process.env.SMOKE_PATIENT_ID || "PAT027";
const ENCOUNTER_NO = process.env.SMOKE_ENCOUNTER_NO || "ENC192";
const STAGING_ID = process.env.SMOKE_STAGING_ID || "STD444";

function mintToken(role: string, userId: string): string {
    return jwt.sign(
        {
            id: userId,
            user_id: userId,
            employee_id: null,
            username: `smoke_${role.toLowerCase()}`,
            role,
            hospital_id: "HSP001",
        },
        SECRET,
        { expiresIn: "1h" }
    );
}

const token = mintToken("HEAD_ADMIN", "USR117");

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

let passed = 0;
let failed = 0;

async function call(method: string, path: string, body?: unknown) {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const json: any = await res.json().catch(() => null);
    return { status: res.status, json };
}

function check(label: string, condition: boolean, detail?: unknown) {
    if (condition) {
        passed += 1;
        console.log(`  PASS  ${label}`);
    } else {
        failed += 1;
        console.log(`  FAIL  ${label}`);
        if (detail !== undefined) console.log("        ", JSON.stringify(detail));
    }
}

async function main() {
    console.log(`\nGenomics smoke test -> ${BASE}\n`);

    // ---------------------------------------------------------------- lookups
    const sites = await call("GET", "/genomics/cancer-sites");
    check("GET /cancer-sites 200", sites.status === 200, sites);
    check("cancer sites non-empty", Array.isArray(sites.json?.data) && sites.json.data.length > 0);

    const genes = await call("GET", "/genomics/genes?site=Lung&sampleType=TISSUE");
    check("GET /genes 200", genes.status === 200, genes);
    check(
        "Lung/TISSUE returns somatic list with EGFR",
        Array.isArray(genes.json?.data?.genes) && genes.json.data.genes.includes("EGFR"),
        genes.json?.data
    );
    check("Lung/TISSUE scope = SOMATIC", genes.json?.data?.scope === "SOMATIC");

    const germlineGenes = await call("GET", "/genomics/genes?site=Breast&sampleType=GERMLINE");
    check(
        "Breast/GERMLINE includes BRCA1",
        Array.isArray(germlineGenes.json?.data?.genes) &&
            germlineGenes.json.data.genes.includes("BRCA1")
    );

    const badType = await call("GET", "/genomics/genes?site=Lung&sampleType=NOPE");
    check("invalid sampleType -> 400", badType.status === 400, badType);

    const labs = await call("GET", `/genomics/labs?patientId=${PATIENT_ID}`);
    check("GET /labs 200", labs.status === 200, labs);

    const before = await call("GET", `/genomics/patients/${PATIENT_ID}/tests`);
    check("GET /patients/:id/tests 200", before.status === 200, before);
    check("list is an array", Array.isArray(before.json?.data));

    // ---------------------------------------------------------------- create
    const payload = {
        sampleType: "TISSUE",
        cancerSite: "Lung",
        reportDate: "2026-11-10",
        collectionDate: "2026-11-05",
        labName: "Smoke Lab",
        panelName: "52-gene solid tumour panel",
        remarks: "Smoke test report - safe to delete",
        encounterNo: ENCOUNTER_NO,
        stagingDetailId: STAGING_ID,
        results: [
            {
                geneSymbol: "EGFR",
                isOtherGene: false,
                status: "PRESENT",
                transcriptDetails: "NM_005228.5:c.2573T>G p.(Leu858Arg), VAF 23%",
            },
            {
                geneSymbol: "ALK",
                isOtherGene: false,
                status: "ABSENT",
                transcriptDetails: null,
            },
        ],
    };

    const created = await call("POST", `/genomics/patients/${PATIENT_ID}/tests`, payload);
    check("POST create -> 201", created.status === 201, created);
    const testId = created.json?.data?.test_id;
    check("test_id generated (GT...)", /^GT\d+$/.test(String(testId)), testId);
    check("staging link saved", created.json?.data?.staging_detail_id === STAGING_ID, created.json?.data);
    check("encounter saved", created.json?.data?.encounter_no === ENCOUNTER_NO);
    check("branch resolved from encounter", Boolean(created.json?.data?.branch_id));
    check(
        "2 gene rows saved",
        Array.isArray(created.json?.data?.genomic_result) &&
            created.json.data.genomic_result.length === 2,
        created.json?.data?.genomic_result
    );
    check(
        "result ids generated (GR...)",
        (created.json?.data?.genomic_result ?? []).every((row: any) => /^GR\d+$/.test(row.result_id))
    );

    // ---------------------------------------------------------- validation
    const noGenes = await call("POST", `/genomics/patients/${PATIENT_ID}/tests`, {
        ...payload,
        results: [],
    });
    check("no genes -> 400", noGenes.status === 400, noGenes);

    const future = await call("POST", `/genomics/patients/${PATIENT_ID}/tests`, {
        ...payload,
        reportDate: "2099-01-01",
    });
    check("future report date -> 400", future.status === 400, future);

    const collectionAfter = await call("POST", `/genomics/patients/${PATIENT_ID}/tests`, {
        ...payload,
        reportDate: "2026-11-10",
        collectionDate: "2026-11-12",
    });
    check("collection after report -> 400", collectionAfter.status === 400, collectionAfter);

    const duplicateGene = await call("POST", `/genomics/patients/${PATIENT_ID}/tests`, {
        ...payload,
        results: [
            { geneSymbol: "EGFR", status: "ABSENT", transcriptDetails: null },
            { geneSymbol: "EGFR", status: "ABSENT", transcriptDetails: null },
        ],
    });
    check("duplicate gene -> 400", duplicateGene.status === 400, duplicateGene);

    const missingTranscript = await call("POST", `/genomics/patients/${PATIENT_ID}/tests`, {
        ...payload,
        results: [{ geneSymbol: "EGFR", status: "PRESENT", transcriptDetails: null }],
    });
    check("Present without transcript -> 400", missingTranscript.status === 400, missingTranscript);

    const offListGene = await call("POST", `/genomics/patients/${PATIENT_ID}/tests`, {
        ...payload,
        results: [{ geneSymbol: "NOTAGENE", status: "ABSENT", transcriptDetails: null }],
    });
    check("gene outside master list -> 400", offListGene.status === 400, offListGene);

    // ---------------------------------------------------------------- read
    const fetched = await call("GET", `/genomics/tests/${testId}`);
    check("GET /tests/:id 200", fetched.status === 200, fetched);
    check("read back matches", fetched.json?.data?.test_id === testId);

    // ---------------------------------------------------------------- update
    const updated = await call("PUT", `/genomics/tests/${testId}`, {
        ...payload,
        remarks: "Updated by smoke test",
        results: [
            {
                geneSymbol: "EGFR",
                isOtherGene: false,
                status: "PRESENT",
                transcriptDetails: "NM_005228.5:c.2573T>G p.(Leu858Arg), VAF 31%",
            },
            { geneSymbol: "ALK", isOtherGene: false, status: "VUS", transcriptDetails: "NM_004304.5:c.1A>G" },
            { geneSymbol: "CUSTOM1", isOtherGene: true, status: "ABSENT", transcriptDetails: null },
        ],
    });
    check("PUT update 200", updated.status === 200, updated);
    check("3 gene rows after update", updated.json?.data?.genomic_result?.length === 3, updated.json?.data);
    check("remarks updated", updated.json?.data?.remarks === "Updated by smoke test");
    check(
        "other gene flagged",
        (updated.json?.data?.genomic_result ?? []).some(
            (row: any) => row.gene_symbol === "CUSTOM1" && row.is_other_gene === true
        )
    );

    // -------------------------------------------------- key alterations
    const alterations = await call("GET", `/genomics/key-alterations?patientId=${PATIENT_ID}`);
    check("GET /key-alterations 200", alterations.status === 200, alterations);
    check(
        "EGFR present appears in key alterations",
        Array.isArray(alterations.json?.data) &&
            alterations.json.data.some((row: any) => row.gene_symbol === "EGFR" && row.test_id === testId),
        alterations.json?.data
    );
    check(
        "VUS is not a key alteration",
        (alterations.json?.data ?? []).every((row: any) => row.status === "PRESENT")
    );

    // -------------------------------------------------- unlinked report
    const unlinked = await call("POST", `/genomics/patients/${PATIENT_ID}/tests`, {
        ...payload,
        stagingDetailId: null,
        encounterNo: "ENC173",
        results: [{ geneSymbol: "KRAS", status: "ABSENT", transcriptDetails: null }],
    });
    check("report without staging link -> 201", unlinked.status === 201, unlinked);
    check("staging_detail_id null", unlinked.json?.data?.staging_detail_id === null, unlinked.json?.data);
    const unlinkedId = unlinked.json?.data?.test_id;

    // --------------------------------------- report file -> patient_document
    const upload = await call("POST", "/patient-documents/upload", {
        patient_id: PATIENT_ID,
        file_name: "smoke-ngs-report.pdf",
        original_name: "smoke-ngs-report.pdf",
        file_type: "application/pdf",
        file_size: 9,
        file_data: "JVBERi0xLjQK",
        category: "Clinical",
        encounter_no: ENCOUNTER_NO,
        document_type: "LAB_REPORT",
    });
    check("upload report file 200/201", upload.status === 200 || upload.status === 201, upload);
    const documentId = upload.json?.data?.document_id || upload.json?.data?.id;
    check("document_id returned", Boolean(documentId), upload.json?.data);

    if (documentId) {
        const withFile = await call("POST", `/genomics/patients/${PATIENT_ID}/tests`, {
            ...payload,
            reportDocumentId: documentId,
            results: [{ geneSymbol: "MET", status: "ABSENT", transcriptDetails: null }],
        });
        check("report links uploaded document", withFile.json?.data?.report_document_id === documentId);
        const withFileId = withFile.json?.data?.test_id;

        const view = await fetch(`${BASE}/patient-documents/${documentId}/view`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        check("stored document is viewable", view.status === 200, view.status);

        if (withFileId) {
            await call("DELETE", `/genomics/tests/${withFileId}`, { reason: "Smoke test cleanup" });
        }

        const docCleanup = await call("DELETE", `/patient-documents/${documentId}`);
        check("uploaded document cleaned up", docCleanup.status === 200, docCleanup);
    }

    // -------------------------------------------------- auto-relink on diagnosis save
    // Simulate a report captured before the diagnosis existed, then save the
    // staging detail: the oncology service must attach the report to it.
    await prisma.genomic_test.update({
        where: { test_id: testId },
        data: { staging_detail_id: null },
    });
    const relinkSave = await call("PUT", `/oncology/staging-details/${STAGING_ID}`, {});
    check("PUT staging detail 200", relinkSave.status === 200, relinkSave);
    const relinked = await call("GET", `/genomics/tests/${testId}`);
    check(
        "pending report auto-relinks on diagnosis save",
        relinked.json?.data?.staging_detail_id === STAGING_ID,
        relinked.json?.data
    );

    // ------------------------------------------- gene master administration
    // A unique symbol per run keeps the test repeatable.
    const SMOKE_GENE = `SMOKE${Date.now().toString().slice(-6)}`;
    const master = await call("GET", "/genomics/gene-master?site=Lung&scope=SOMATIC");
    check("GET /gene-master 200", master.status === 200, master);
    check("Lung somatic master rows", (master.json?.data ?? []).length >= 13);

    const newGene = await call("POST", "/genomics/gene-master", {
        cancerSite: "Lung",
        scope: "SOMATIC",
        geneSymbol: SMOKE_GENE,
    });
    check("POST /gene-master 201", newGene.status === 201, newGene);
    check("gene id generated (GM...)", /^GM\d+$/.test(String(newGene.json?.data?.gene_master_id)));
    const geneId = newGene.json?.data?.gene_master_id;

    const dupGene = await call("POST", "/genomics/gene-master", {
        cancerSite: "Lung",
        scope: "SOMATIC",
        geneSymbol: SMOKE_GENE,
    });
    check("duplicate gene -> 400", dupGene.status === 400, dupGene);

    const deactivated = await call("PUT", `/genomics/gene-master/${geneId}`, { active: false });
    check("PUT deactivate gene 200", deactivated.status === 200, deactivated);
    check("gene inactive", deactivated.json?.data?.active === false);

    const afterDeactivate = await call("GET", "/genomics/genes?site=Lung&sampleType=TISSUE");
    check(
        "deactivated gene leaves dropdown",
        !(afterDeactivate.json?.data?.genes ?? []).includes(SMOKE_GENE)
    );

    const removedGene = await call("DELETE", `/genomics/gene-master/${geneId}`);
    check("DELETE unused gene 200", removedGene.status === 200, removedGene);

    const usedGene = await call("GET", "/genomics/gene-master?site=Lung&scope=SOMATIC");
    const egfr = (usedGene.json?.data ?? []).find((row: any) => row.gene_symbol === "EGFR");
    if (egfr) {
        const blocked = await call("DELETE", `/genomics/gene-master/${egfr.gene_master_id}`);
        check("deleting a gene used in reports -> 400", blocked.status === 400, blocked);
    }

    // ---------------------------------------------------------------- delete
    const noReason = await call("DELETE", `/genomics/tests/${testId}`, {});
    check("delete without reason -> 400", noReason.status === 400, noReason);

    const deleted = await call("DELETE", `/genomics/tests/${testId}`, {
        reason: "Smoke test cleanup",
    });
    check("DELETE with reason 200", deleted.status === 200, deleted);

    const afterDelete = await call("GET", `/genomics/patients/${PATIENT_ID}/tests`);
    check(
        "deleted report leaves the list",
        !(afterDelete.json?.data ?? []).some((row: any) => row.test_id === testId)
    );

    if (unlinkedId) {
        await call("DELETE", `/genomics/tests/${unlinkedId}`, { reason: "Smoke test cleanup" });
    }

    // ------------------------------------------------------------- summary
    console.log(`\n${passed} passed, ${failed} failed\n`);
    if (failed > 0) process.exitCode = 1;
}

main()
    .catch((error) => {
        console.error("Smoke test crashed:", error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
