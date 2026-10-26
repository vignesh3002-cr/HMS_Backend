import "dotenv/config";
import * as XLSX from "xlsx";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DEFAULT_EXCEL_PATH =
    process.env.DRUG_MONITORING_XLSX_PATH ??
    "C:\\Users\\ADMIN\\Downloads\\Drug_Monitoring_Blood_Tests.xlsx";

interface ParsedExcelRow {
    medicine_name: string | null;
    generic_name: string | null;
    lab_test_name: string | null;
    monitoring_phase: string | null;
    investigation_name: string | null;
    investigation_type: string | null;
    source_test_text: string | null;
}

function normalize(value?: string | null): string {
    return (value ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function scoreTestMatch(
    target: { lab_test_id: string; test_name: string },
    mappingName: string
): number {
    const targetName = normalize(target.test_name);
    const mapping = normalize(mappingName);
    if (!mapping) return 0;
    if (targetName === mapping) return 10000;
    if (mapping.length >= 4 && targetName.includes(mapping)) return 2000 + mapping.length;
    if (targetName.length >= 4 && mapping.includes(targetName)) return 1500 + targetName.length;
    const tTokens = new Set(targetName.split(" ").filter(Boolean));
    const mTokens = new Set(mapping.split(" ").filter(Boolean));
    let overlap = 0;
    for (const t of tTokens) if (mTokens.has(t)) overlap += 1;
    return overlap > 0 ? overlap * 100 : 0;
}

function scoreMedicineTextMatch(
    medicine: { medicine_id: string; medicine_name: string; generic_name: string | null },
    targetName: string
): number {
    const nameKey = normalize(medicine.medicine_name);
    const genericKey = normalize(medicine.generic_name);
    const target = normalize(targetName);
    if (!target) return 0;
    if (nameKey === target || genericKey === target) return 10000;
    let best = 0;
    for (const key of [nameKey, genericKey].filter(Boolean)) {
        if (!key) continue;
        if (key.length >= 4 && target.includes(key)) best = Math.max(best, 2000 + key.length);
        if (target.length >= 4 && key.includes(target)) best = Math.max(best, 1500 + target.length);
        const tTokens = new Set(key.split(" ").filter(Boolean));
        const mTokens = new Set(target.split(" ").filter(Boolean));
        let overlap = 0;
        for (const t of tTokens) if (mTokens.has(t)) overlap += 1;
        best = Math.max(best, overlap > 0 ? overlap * 100 : 0);
    }
    return best;
}

function findBestMedicine(
    targetName: string,
    medicines: { medicine_id: string; medicine_name: string; generic_name: string | null }[]
): { medicine_id: string; medicine_name: string; generic_name: string | null } | null {
    let best: { medicine_id: string; medicine_name: string; generic_name: string | null } | null = null;
    let bestScore = 0;
    for (const med of medicines) {
        const score = scoreMedicineTextMatch(med, targetName);
        if (score > bestScore) {
            best = med;
            bestScore = score;
        }
    }
    return bestScore >= 200 ? best : null;
}

function findBestLabTest(

    testName: string,
    labTestByName: Map<string, { lab_test_id: string; test_name: string }>,
    labTests: { lab_test_id: string; test_name: string }[]
): { lab_test_id: string; test_name: string } | null {
    const key = normalize(testName);
    if (key && labTestByName.has(key)) {
        return labTestByName.get(key)!;
    }
    let best: { lab_test_id: string; test_name: string } | null = null;
    let bestScore = 0;
    for (const test of labTests) {
        const score = scoreTestMatch(test, testName);
        if (score > bestScore) {
            best = test;
            bestScore = score;
        }
    }
    // Require a meaningful overlap to avoid wrong matches
    return bestScore >= 200 ? best : null;
}

function findColumn(
    headers: string[],
    candidates: string[]
): string | undefined {
    const normalized = headers.map((h) => normalize(h));
    for (const candidate of candidates) {
        const cn = normalize(candidate);
        // Exact match first, then substring match (either direction) so that
        // verbose headers like "Blood / Lab tests (monitoring) BASE LINE"
        // still match a candidate such as "lab test" / "blood test".
        const exactIndex = normalized.findIndex((h) => h === cn);
        if (exactIndex !== -1) return headers[exactIndex];
        const containsIndex = normalized.findIndex(
            (h) => h.includes(cn) || cn.includes(h)
        );
        if (containsIndex !== -1) return headers[containsIndex];
    }
    return undefined;
}

function parseExcelRows(
    filePath: string
): {
    headers: string[];
    rows: ParsedExcelRow[];
    sheetName: string;
} {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });

    if (!raw || raw.length === 0) {
        throw new Error("Excel sheet is empty.");
    }

    const headers = (raw[0] as any[]).map((h) => String(h ?? "").trim());
    const colMedicine = findColumn(headers, [
        "medicine_name",
        "medicine name",
        "drug name",
        "drug_name",
    ]);
    const colGeneric = findColumn(headers, [
        "generic_name",
        "generic name",
    ]);
    const colLabTest = findColumn(headers, [
        "lab_test_name",
        "lab test name",
        "blood test",
        "lab test",
    ]);
    const colPhase = findColumn(headers, [
        "monitoring_phase",
        "monitoring phase",
        "phase",
    ]);
    const colInvestigation = findColumn(headers, [
        "investigation_name",
        "investigation name",
        "non-lab investigation",
        "other investigation",
        "non lab investigation",
    ]);
    const colInvestigationType = findColumn(headers, [
        "investigation_type",
        "investigation type",
        "type",
    ]);
    const colSourceText = findColumn(headers, [
        "source_test_text",
        "source test text",
        "notes",
        "remarks",
    ]);

    if (!colMedicine) {
        throw new Error(
            "No medicine name column found in Excel. Expected one of: medicine_name, medicine name, drug name, drug_name."
        );
    }

    const medicineIdx = headers.indexOf(colMedicine);
    const genericIdx = colGeneric ? headers.indexOf(colGeneric) : -1;
    const labTestIdx = colLabTest ? headers.indexOf(colLabTest) : -1;
    const phaseIdx = colPhase ? headers.indexOf(colPhase) : -1;
    const investigationIdx = colInvestigation
        ? headers.indexOf(colInvestigation)
        : -1;
    const investigationTypeIdx = colInvestigationType
        ? headers.indexOf(colInvestigationType)
        : -1;
    const sourceTextIdx = colSourceText ? headers.indexOf(colSourceText) : -1;

    const rows: ParsedExcelRow[] = (raw.slice(1) as any[]).map((row) => {
        const get = (index: number) =>
            index !== -1 ? row[index] : undefined;
        return {
            medicine_name:
                get(medicineIdx) != null
                    ? String(get(medicineIdx))
                    : null,
            generic_name:
                get(genericIdx) != null ? String(get(genericIdx)) : null,
            lab_test_name: get(labTestIdx) != null ? String(get(labTestIdx)) : null,
            monitoring_phase:
                get(phaseIdx) != null
                    ? String(get(phaseIdx))
                    : "BASELINE",
            investigation_name:
                get(investigationIdx) != null
                    ? String(get(investigationIdx))
                    : null,
            investigation_type:
                get(investigationTypeIdx) != null
                    ? String(get(investigationTypeIdx))
                    : null,
            source_test_text:
                get(sourceTextIdx) != null ? String(get(sourceTextIdx)) : null,
        };
    });

    return { headers, rows, sheetName };
}

async function resolveMedicineId(
    medicineName: string | null,
    genericName: string | null,
    medicineByName: Map<
        string,
        { medicine_id: string; medicine_name: string; generic_name: string | null }
    >,
    medicineByGeneric: Map<
        string,
        { medicine_id: string; medicine_name: string; generic_name: string | null }
    >,
    medicines: { medicine_id: string; medicine_name: string; generic_name: string | null }[]
): Promise<string | null> {
    const nameKey = normalize(medicineName);
    const genericKey = normalize(genericName);

    if (nameKey && medicineByName.has(nameKey)) {
        return medicineByName.get(nameKey)!.medicine_id;
    }
    if (genericKey && medicineByGeneric.has(genericKey)) {
        return medicineByGeneric.get(genericKey)!.medicine_id;
    }
    // Fuzzy fallback: match by medicine_name / generic_name (e.g. Excel
    // "Trastuzumab" vs master "Inj Trastuzumab").
    if (medicineName) {
        const best = findBestMedicine(medicineName, medicines);
        if (best) return best.medicine_id;
    }
    return null;
}

async function resolveLabTestId(
    testName: string | null,
    labTestByName: Map<string, { lab_test_id: string; test_name: string }>,
    labTests: { lab_test_id: string; test_name: string }[]
): Promise<string | null> {
    if (!testName) return null;
    const best = findBestLabTest(testName, labTestByName, labTests);
    return best?.lab_test_id ?? null;
}

interface ImportResult {
    rowsProcessed: number;
    labMappingsUpserted: number;
    nonLabMappingsUpserted: number;
    medicinesUnmatched: number;
    labTestsUnmatched: number;
    unmatched: string[];
}

export async function importDrugMonitoringMappingsFromRows(
    rows: ParsedExcelRow[]
): Promise<ImportResult> {
    // Load all active medicines for matching.
    const medicines = await prisma.medicine_master.findMany({
        where: { is_active: true },
        select: { medicine_id: true, medicine_name: true, generic_name: true },
    });

    const medicineByName = new Map(
        medicines.map((m) => [normalize(m.medicine_name), m])
    );
    const medicineByGeneric = new Map(
        medicines
            .filter((m) => m.generic_name)
            .map((m) => [normalize(m.generic_name)!, m])
    );

    // Load all active lab tests for matching.
    const labTests = await prisma.lab_test_master.findMany({
        where: { test_status: 1 },
        select: { lab_test_id: true, test_name: true },
    });
    const labTestByName = new Map(
        labTests.map((t) => [normalize(t.test_name), t])
    );

    let rowsProcessed = 0;
    let labMappingsUpserted = 0;
    let nonLabMappingsUpserted = 0;
    let medicinesUnmatched = 0;
    let labTestsUnmatched = 0;
    const unmatched: string[] = [];

    for (const row of rows) {
        if (!row.medicine_name || row.medicine_name.trim() === "") {
            continue;
        }

        rowsProcessed += 1;

        const medicineId = await resolveMedicineId(
            row.medicine_name,
            row.generic_name,
            medicineByName,
            medicineByGeneric,
            medicines
        );

        if (!medicineId) {
            medicinesUnmatched += 1;
            unmatched.push(`Medicine not found: ${row.medicine_name}`);
            continue;
        }

        // Upsert lab monitoring mapping. A cell may list several tests
        // separated by ";" (e.g. "Pregnancy test; HBV screen; CBC"), so
        // create one mapping per individual test.
        const labTestsList = row.lab_test_name
            ? row.lab_test_name.split(";").map((t) => t.trim()).filter(Boolean)
            : [];
        for (const singleLabTest of labTestsList) {
            const labTestId = await resolveLabTestId(
                singleLabTest,
                labTestByName,
                labTests
            );

            if (!labTestId) {
                labTestsUnmatched += 1;
                unmatched.push(
                    `Lab test not found for medicine ${row.medicine_name}: ${singleLabTest}`
                );
                continue;
            }

            await prisma.drug_lab_monitoring.upsert({
                where: {
                    medicine_id_lab_test_id_monitoring_phase: {
                        medicine_id: medicineId,
                        lab_test_id: labTestId,
                        monitoring_phase:
                            row.monitoring_phase?.trim() || "BASELINE",
                    },
                },
                update: {
                    source_test_text: row.source_test_text
                        ? row.source_test_text
                        : null,
                    active_status: 1,
                },
                create: {
                    monitoring_id: crypto.randomUUID(),
                    medicine_id: medicineId,
                    lab_test_id: labTestId,
                    source_test_text: row.source_test_text
                        ? row.source_test_text
                        : null,
                    monitoring_phase:
                        row.monitoring_phase?.trim() || "BASELINE",
                    active_status: 1,
                },
            });
            labMappingsUpserted += 1;
        }

        // Upsert non-lab investigation mapping.
        if (
            row.investigation_name &&
            row.investigation_name.trim() !== ""
        ) {
            await prisma.drug_non_lab_investigation.upsert({
                where: {
                    medicine_id_investigation_name: {
                        medicine_id: medicineId,
                        investigation_name: row.investigation_name.trim(),
                    },
                },
                update: {
                    investigation_type: row.investigation_type
                        ? row.investigation_type
                        : null,
                    active_status: 1,
                },
                create: {
                    investigation_id: crypto.randomUUID(),
                    medicine_id: medicineId,
                    investigation_name: row.investigation_name.trim(),
                    investigation_type: row.investigation_type
                        ? row.investigation_type
                        : null,
                    active_status: 1,
                },
            });
            nonLabMappingsUpserted += 1;
        }
    }

    return {
        rowsProcessed,
        labMappingsUpserted,
        nonLabMappingsUpserted,
        medicinesUnmatched,
        labTestsUnmatched,
        unmatched,
    };
}

export async function seedDrugMonitoringMappings() {
    console.log("Seeding drug monitoring mappings from Excel...");
    console.log(`  Source: ${DEFAULT_EXCEL_PATH}`);

    const { rows } = parseExcelRows(DEFAULT_EXCEL_PATH);
    console.log(
        `  Parsed ${rows.length} row(s) from sheet.`
    );

    const result = await importDrugMonitoringMappingsFromRows(rows);

    console.log(`  Rows processed: ${result.rowsProcessed}`);
    console.log(`  Lab mappings upserted: ${result.labMappingsUpserted}`);
    console.log(`  Non-lab mappings upserted: ${result.nonLabMappingsUpserted}`);
    console.log(`  Medicines unmatched: ${result.medicinesUnmatched}`);
    console.log(`  Lab tests unmatched: ${result.labTestsUnmatched}`);

    if (result.unmatched.length > 0) {
        console.log("  Unmatched items:");
        for (const item of result.unmatched) {
            console.log(`    - ${item}`);
        }
    }

    return result;
}

if (require.main === module) {
    seedDrugMonitoringMappings()
        .then(() => prisma.$disconnect())
        .catch((error) => {
            console.error(error);
            prisma.$disconnect();
            process.exit(1);
        });
}
