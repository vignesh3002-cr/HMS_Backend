import "dotenv/config";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const EXCEL_PATH =
    process.env.DRUG_MONITORING_XLSX_PATH ??
    "C:\\Users\\ADMIN\\Downloads\\Drug_Monitoring_Blood_Tests.xlsx";

interface ExcelRow {
    medicine_name?: string | null;
    generic_name?: string | null;
    lab_test_name?: string | null;
    monitoring_phase?: string | null;
    investigation_name?: string | null;
    investigation_type?: string | null;
    source_test_text?: string | null;
}

function normalize(value?: string | null): string {
    return (value ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function findColumn(headers: string[], candidates: string[]): string | undefined {
    const normalized = headers.map((h) => normalize(h));
    for (const candidate of candidates) {
        const cn = normalize(candidate);
        const index = normalized.findIndex((h) => h === cn);
        if (index !== -1) return headers[index];
    }
    return undefined;
}

async function resolveMedicineId(
    medicineName: string | null | undefined,
    genericName: string | null | undefined,
    medicineByName: Map<string, { medicine_id: string; medicine_name: string; generic_name: string | null }>,
    medicineByGeneric: Map<string, { medicine_id: string; medicine_name: string; generic_name: string | null }>
): Promise<string | null> {
    const nameKey = normalize(medicineName);
    const genericKey = normalize(genericName);

    if (nameKey && medicineByName.has(nameKey)) {
        return medicineByName.get(nameKey)!.medicine_id;
    }
    if (genericKey && medicineByGeneric.has(genericKey)) {
        return medicineByGeneric.get(genericKey)!.medicine_id;
    }
    return null;
}

async function resolveLabTestId(
    testName: string | null | undefined,
    labTestByName: Map<string, { lab_test_id: string; test_name: string }>
): Promise<string | null> {
    if (!testName) return null;
    const key = normalize(testName);
    if (key && labTestByName.has(key)) {
        return labTestByName.get(key)!.lab_test_id;
    }
    return null;
}

export async function seedDrugMonitoringMappings() {
    console.log("Seeding drug monitoring mappings from Excel...");
    console.log(`  Source: ${EXCEL_PATH}`);

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

    // Read the Excel workbook.
    let workbook: XLSX.WorkBook;
    try {
        workbook = XLSX.readFile(EXCEL_PATH);
    } catch (error: any) {
        throw new Error(
            `Failed to read Excel file at ${EXCEL_PATH}: ${error?.message ?? error}`
        );
    }

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

    console.log(
        `  Columns detected: medicine=${colMedicine ?? "none"} generic=${colGeneric ?? "none"} labTest=${colLabTest ?? "none"} phase=${colPhase ?? "none"} investigation=${colInvestigation ?? "none"} type=${colInvestigationType ?? "none"} sourceText=${colSourceText ?? "none"}`
    );

    if (!colMedicine) {
        throw new Error(
            "No medicine name column found in Excel. Expected one of: medicine_name, medicine name, drug name, drug_name."
        );
    }

    let rowsProcessed = 0;
    let labMappingsUpserted = 0;
    let nonLabMappingsUpserted = 0;
    let medicinesUnmatched = 0;
    let labTestsUnmatched = 0;
    const unmatched: string[] = [];

    const rows = raw.slice(1) as any[];

    for (const row of rows) {
        const medicineName = row[headers.indexOf(colMedicine)] ?? null;
        const genericName = colGeneric
            ? row[headers.indexOf(colGeneric)] ?? null
            : null;
        const labTestName = colLabTest
            ? row[headers.indexOf(colLabTest)] ?? null
            : null;
        const monitoringPhase = colPhase
            ? (row[headers.indexOf(colPhase)] ?? "BASELINE")
            : "BASELINE";
        const investigationName = colInvestigation
            ? row[headers.indexOf(colInvestigation)] ?? null
            : null;
        const investigationType = colInvestigationType
            ? row[headers.indexOf(colInvestigationType)] ?? null
            : null;
        const sourceTestText = colSourceText
            ? row[headers.indexOf(colSourceText)] ?? null
            : null;

        if (!medicineName || String(medicineName).trim() === "") {
            continue;
        }

        rowsProcessed += 1;

        const medicineId = await resolveMedicineId(
            String(medicineName),
            genericName ? String(genericName) : null,
            medicineByName,
            medicineByGeneric
        );

        if (!medicineId) {
            medicinesUnmatched += 1;
            unmatched.push(`Medicine not found: ${medicineName}`);
            continue;
        }

        // Upsert lab monitoring mapping.
        if (labTestName && String(labTestName).trim() !== "") {
            const labTestId = await resolveLabTestId(
                String(labTestName),
                labTestByName
            );

            if (!labTestId) {
                labTestsUnmatched += 1;
                unmatched.push(
                    `Lab test not found for medicine ${medicineName}: ${labTestName}`
                );
            } else {
                await prisma.drug_lab_monitoring.upsert({
                    where: {
                        medicine_id_lab_test_id_monitoring_phase: {
                            medicine_id: medicineId,
                            lab_test_id: labTestId,
                            monitoring_phase: String(monitoringPhase).trim() || "BASELINE",
                        },
                    },
                    update: {
                        source_test_text: sourceTestText
                            ? String(sourceTestText)
                            : null,
                        active_status: 1,
                    },
                    create: {
                        medicine_id: medicineId,
                        lab_test_id: labTestId,
                        source_test_text: sourceTestText
                            ? String(sourceTestText)
                            : null,
                        monitoring_phase:
                            String(monitoringPhase).trim() || "BASELINE",
                        active_status: 1,
                    },
                });
                labMappingsUpserted += 1;
            }
        }

        // Upsert non-lab investigation mapping.
        if (investigationName && String(investigationName).trim() !== "") {
            await prisma.drug_non_lab_investigation.upsert({
                where: {
                    medicine_id_investigation_name: {
                        medicine_id: medicineId,
                        investigation_name: String(investigationName).trim(),
                    },
                },
                update: {
                    investigation_type: investigationType
                        ? String(investigationType)
                        : null,
                    active_status: 1,
                },
                create: {
                    medicine_id: medicineId,
                    investigation_name: String(investigationName).trim(),
                    investigation_type: investigationType
                        ? String(investigationType)
                        : null,
                    active_status: 1,
                },
            });
            nonLabMappingsUpserted += 1;
        }
    }

    console.log(`  Rows processed: ${rowsProcessed}`);
    console.log(`  Lab mappings upserted: ${labMappingsUpserted}`);
    console.log(`  Non-lab mappings upserted: ${nonLabMappingsUpserted}`);
    console.log(`  Medicines unmatched: ${medicinesUnmatched}`);
    console.log(`  Lab tests unmatched: ${labTestsUnmatched}`);

    if (unmatched.length > 0) {
        console.log("  Unmatched items:");
        for (const item of unmatched) {
            console.log(`    - ${item}`);
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

if (require.main === module) {
    seedDrugMonitoringMappings()
        .then(() => prisma.$disconnect())
        .catch((error) => {
            console.error(error);
            prisma.$disconnect();
            process.exit(1);
        });
}
