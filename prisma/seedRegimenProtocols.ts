import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { generateId } from "../src/utils/idGenerator";

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Named regimen templates a doctor can pick on the create-plan screen to
// pre-fill planned_cycles + the standard drug/dose list + standard
// premedication - every field stays editable before the
// confirm_suggested_therapy gate on POST /chemotherapy/plans, so this is a
// starting point, not a constraint the API enforces.
//
// chemotherapy_plan (and therefore chemotherapy_plan_items) has a single
// fixed drug list repeated across all of its cycles - it doesn't model a
// regimen that changes drugs partway through (e.g. AC-T is 4 cycles of AC
// then 4 cycles of a taxane). Rather than redesign that pre-existing table,
// a multi-phase protocol like AC-T is represented as one record whose items
// carry a `phase` note in remarks (e.g. "Cycles 1-4 only") - the actual
// per-cycle administration is already recorded per plan_item
// (chemotherapy_administration.chemotherapy_plan_item_id), so a nurse only
// ever administers the items relevant to the cycle they're on regardless of
// what the plan's full item list contains.
interface ProtocolItemSeed {
    medicine_name: string;
    drug_role: "PRIMARY" | "PREMEDICATION";
    drug_sequence: number;
    dosage?: number;
    dosage_unit?: string;
    administration_route?: string;
    frequency?: string;
    timing_relative_to_primary?: string;
    remarks?: string;
}

interface ProtocolSeed {
    regimen_code: string;
    regimen_name: string;
    cancer_type: string;
    subtype_name?: string;
    treatment_intent: string;
    standard_cycles: number | null;
    cycle_interval_days: number | null;
    guideline_source: string;
    notes?: string;
    items: ProtocolItemSeed[];
}

const STANDARD_PREMEDS: ProtocolItemSeed[] = [
    { medicine_name: "Dexamethasone", drug_role: "PREMEDICATION", drug_sequence: 90, dosage: 8, dosage_unit: "mg", administration_route: "IV", timing_relative_to_primary: "30 min before", remarks: "Infusion-reaction prophylaxis" },
    { medicine_name: "Diphenhydramine", drug_role: "PREMEDICATION", drug_sequence: 91, dosage: 50, dosage_unit: "mg", administration_route: "IV", timing_relative_to_primary: "30 min before", remarks: "Infusion-reaction prophylaxis" },
    { medicine_name: "Famotidine", drug_role: "PREMEDICATION", drug_sequence: 92, dosage: 20, dosage_unit: "mg", administration_route: "IV", timing_relative_to_primary: "30 min before", remarks: "Infusion-reaction prophylaxis" },
    { medicine_name: "Ondansetron 4 mg", drug_role: "PREMEDICATION", drug_sequence: 93, dosage: 8, dosage_unit: "mg", administration_route: "IV", timing_relative_to_primary: "30 min before", remarks: "Antiemetic prophylaxis" },
];

const PROTOCOLS: ProtocolSeed[] = [
    {
        regimen_code: "AC-T",
        regimen_name: "Doxorubicin/Cyclophosphamide followed by Paclitaxel",
        cancer_type: "Breast",
        treatment_intent: "Neoadjuvant/Adjuvant",
        standard_cycles: 8,
        cycle_interval_days: 21,
        guideline_source: "NCCN Breast v4.2024",
        notes: "Two-phase regimen: AC for cycles 1-4, then paclitaxel for cycles 5-8. Applies broadly across HR+/HER2- and TNBC subtypes - not HER2+ (see TCH/TCHP).",
        items: [
            { medicine_name: "Doxorubicin", drug_role: "PRIMARY", drug_sequence: 1, dosage: 60, dosage_unit: "mg/m2", administration_route: "IV", frequency: "Day 1 of cycle", remarks: "Cycles 1-4 only (AC phase)" },
            { medicine_name: "Cyclophosphamide", drug_role: "PRIMARY", drug_sequence: 2, dosage: 600, dosage_unit: "mg/m2", administration_route: "IV", frequency: "Day 1 of cycle", remarks: "Cycles 1-4 only (AC phase)" },
            { medicine_name: "Paclitaxel", drug_role: "PRIMARY", drug_sequence: 3, dosage: 175, dosage_unit: "mg/m2", administration_route: "IV", frequency: "Day 1 of cycle", remarks: "Cycles 5-8 only (taxane phase)" },
            ...STANDARD_PREMEDS,
        ],
    },
    {
        regimen_code: "TCH",
        regimen_name: "Docetaxel/Carboplatin/Trastuzumab",
        cancer_type: "Breast",
        treatment_intent: "Neoadjuvant/Adjuvant",
        standard_cycles: 6,
        cycle_interval_days: 21,
        guideline_source: "NCCN Breast v4.2024 (BCIRG-006)",
        notes: "For HER2+ subtypes (Luminal B HER2+, HER2-enriched) - anthracycline-sparing option.",
        items: [
            { medicine_name: "Docetaxel", drug_role: "PRIMARY", drug_sequence: 1, dosage: 75, dosage_unit: "mg/m2", administration_route: "IV", frequency: "Day 1 of cycle" },
            { medicine_name: "Carboplatin", drug_role: "PRIMARY", drug_sequence: 2, dosage: 6, dosage_unit: "AUC", administration_route: "IV", frequency: "Day 1 of cycle" },
            { medicine_name: "Trastuzumab", drug_role: "PRIMARY", drug_sequence: 3, dosage: 6, dosage_unit: "mg/kg", administration_route: "IV", frequency: "Day 1 of cycle", remarks: "8 mg/kg loading dose on cycle 1" },
            ...STANDARD_PREMEDS,
        ],
    },
    {
        regimen_code: "TCHP",
        regimen_name: "Docetaxel/Carboplatin/Trastuzumab/Pertuzumab",
        cancer_type: "Breast",
        treatment_intent: "Neoadjuvant/Adjuvant",
        standard_cycles: 6,
        cycle_interval_days: 21,
        guideline_source: "NCCN Breast v4.2024 (TRYPHAENA/BERENICE)",
        notes: "For HER2+ subtypes (Luminal B HER2+, HER2-enriched) - dual HER2 blockade, preferred neoadjuvant option.",
        items: [
            { medicine_name: "Docetaxel", drug_role: "PRIMARY", drug_sequence: 1, dosage: 75, dosage_unit: "mg/m2", administration_route: "IV", frequency: "Day 1 of cycle" },
            { medicine_name: "Carboplatin", drug_role: "PRIMARY", drug_sequence: 2, dosage: 6, dosage_unit: "AUC", administration_route: "IV", frequency: "Day 1 of cycle" },
            { medicine_name: "Trastuzumab", drug_role: "PRIMARY", drug_sequence: 3, dosage: 6, dosage_unit: "mg/kg", administration_route: "IV", frequency: "Day 1 of cycle", remarks: "8 mg/kg loading dose on cycle 1" },
            { medicine_name: "Pertuzumab", drug_role: "PRIMARY", drug_sequence: 4, dosage: 420, dosage_unit: "mg", administration_route: "IV", frequency: "Day 1 of cycle", remarks: "840 mg loading dose on cycle 1" },
            ...STANDARD_PREMEDS,
        ],
    },
    {
        regimen_code: "LET-PALBO",
        regimen_name: "Letrozole + Palbociclib",
        cancer_type: "Breast",
        subtype_name: undefined,
        treatment_intent: "Maintenance/Adjuvant",
        standard_cycles: null,
        cycle_interval_days: 28,
        guideline_source: "NCCN Breast v4.2024",
        notes: "For HR+/HER2- subtypes (Luminal A, Luminal B HER2-). Oral, continuous until progression - standard_cycles left null since there's no fixed course length.",
        items: [
            { medicine_name: "Letrozole", drug_role: "PRIMARY", drug_sequence: 1, dosage: 2.5, dosage_unit: "mg", administration_route: "Oral", frequency: "Once daily, continuous" },
            { medicine_name: "Palbociclib", drug_role: "PRIMARY", drug_sequence: 2, dosage: 125, dosage_unit: "mg", administration_route: "Oral", frequency: "Once daily, 21 days on / 7 days off" },
        ],
    },
    {
        regimen_code: "OSI",
        regimen_name: "Osimertinib",
        cancer_type: "Lung",
        subtype_name: "Adenocarcinoma",
        treatment_intent: "Palliative/Targeted",
        standard_cycles: null,
        cycle_interval_days: 28,
        guideline_source: "NCCN NSCLC v2.2024 (FLAURA)",
        notes: "EGFR exon19del/L858R or T790M-positive only - oral TKI, continuous until progression. No infusion, so no premedication required.",
        items: [
            { medicine_name: "Osimertinib", drug_role: "PRIMARY", drug_sequence: 1, dosage: 80, dosage_unit: "mg", administration_route: "Oral", frequency: "Once daily, continuous" },
        ],
    },
    {
        regimen_code: "CARBO-PEMBRO",
        regimen_name: "Carboplatin + Pembrolizumab",
        cancer_type: "Lung",
        treatment_intent: "Palliative",
        standard_cycles: 4,
        cycle_interval_days: 21,
        guideline_source: "NCCN NSCLC v2.2024 (KEYNOTE-407/189)",
        notes: "Driver-negative (EGFR/ALK-negative) NSCLC. 4-cycle induction; pembrolizumab typically continues alone as maintenance afterward as a separate plan.",
        items: [
            { medicine_name: "Carboplatin", drug_role: "PRIMARY", drug_sequence: 1, dosage: 5, dosage_unit: "AUC", administration_route: "IV", frequency: "Day 1 of cycle" },
            { medicine_name: "Pembrolizumab", drug_role: "PRIMARY", drug_sequence: 2, dosage: 200, dosage_unit: "mg", administration_route: "IV", frequency: "Day 1 of cycle" },
            ...STANDARD_PREMEDS,
        ],
    },
];

export async function seedRegimenProtocols() {

    console.log("Seeding chemotherapy_regimen_protocol...");

    let seeded = 0;
    let skipped = 0;

    for (const protocol of PROTOCOLS) {

        const cancerType = await prisma.cancer_types.findUnique({ where: { cancer_type: protocol.cancer_type } });

        if (!cancerType) {
            throw new Error(`Cancer type not found: ${protocol.cancer_type} - run db:seed:oncology first`);
        }

        const subtype = protocol.subtype_name
            ? await prisma.cancer_subtypes.findFirst({
                where: { cancer_type_id: cancerType.cancer_type_id, subtype_name: protocol.subtype_name },
            })
            : null;

        if (protocol.subtype_name && !subtype) {
            throw new Error(`Cancer subtype not found: ${protocol.subtype_name}`);
        }

        const existing = await prisma.chemotherapy_regimen_protocol.findFirst({
            where: {
                cancer_type_id: cancerType.cancer_type_id,
                subtype_id: subtype?.subtype_id ?? null,
                regimen_code: protocol.regimen_code,
            },
        });

        if (existing) {
            skipped++;
            continue;
        }

        await prisma.$transaction(async (tx) => {

            const protocolId = await generateId(tx, "REGIMEN_PROTOCOL");

            await tx.chemotherapy_regimen_protocol.create({
                data: {
                    protocol_id: protocolId,
                    regimen_code: protocol.regimen_code,
                    regimen_name: protocol.regimen_name,
                    cancer_type_id: cancerType.cancer_type_id,
                    subtype_id: subtype?.subtype_id ?? null,
                    treatment_intent: protocol.treatment_intent,
                    standard_cycles: protocol.standard_cycles,
                    cycle_interval_days: protocol.cycle_interval_days,
                    guideline_source: protocol.guideline_source,
                    notes: protocol.notes ?? null,
                },
            });

            for (const item of protocol.items) {

                const medicine = await tx.medicine_master.findFirst({ where: { medicine_name: item.medicine_name } });

                if (!medicine) {
                    throw new Error(`Medicine not found: ${item.medicine_name} - run db:seed:chemo-drugs first`);
                }

                const itemId = await generateId(tx, "REGIMEN_PROTOCOL_ITEM");

                await tx.chemotherapy_regimen_protocol_items.create({
                    data: {
                        protocol_item_id: itemId,
                        protocol_id: protocolId,
                        medicine_id: medicine.medicine_id,
                        drug_role: item.drug_role,
                        drug_sequence: item.drug_sequence,
                        dosage: item.dosage ?? null,
                        dosage_unit: item.dosage_unit ?? null,
                        administration_route: item.administration_route ?? null,
                        frequency: item.frequency ?? null,
                        timing_relative_to_primary: item.timing_relative_to_primary ?? null,
                        remarks: item.remarks ?? null,
                    },
                });

            }

        }, { timeout: 30000 });

        seeded++;

    }

    console.log(`  ${seeded} regimen protocols added, ${skipped} already present`);

}

if (require.main === module) {

    seedRegimenProtocols()
        .catch((error) => {
            console.error(error);
            process.exit(1);
        })
        .finally(() => prisma.$disconnect());

}
