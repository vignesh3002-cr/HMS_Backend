import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Reuses the existing medicine_master table rather than duplicating a
// separate "chemo drug" catalog - chemotherapy_plan_items.medicine_id FKs
// straight into it. Only the drugs referenced by this module's own
// documented suggested_therapy advisories (chemo.derivation.ts) plus the
// common IV chemo backbone agents are seeded here; anything else can be
// added later through whatever general medicine-management screen exists.
//
// medicine_master has no dedicated id_sequences entry (unlike every other
// entity this session added) - it already has its own informal 6-digit
// "MED" + zero-padded-6 convention with real existing rows (MED000001..
// MED000027), so this script continues that exact format instead of
// introducing a differently-shaped id_sequences-based scheme for one table.
interface ChemoDrugRow {
    medicine_name: string;
    generic_name: string;
    strength: string;
    dosage_form: string;
    route: string;
    unit: string;
    category?: string;
}

const CHEMO_DRUGS: ChemoDrugRow[] = [
    { medicine_name: "Trastuzumab", generic_name: "Trastuzumab", strength: "440 mg", dosage_form: "Injection", route: "IV", unit: "Vial" },
    { medicine_name: "Pertuzumab", generic_name: "Pertuzumab", strength: "420 mg", dosage_form: "Injection", route: "IV", unit: "Vial" },
    { medicine_name: "Ado-trastuzumab emtansine (T-DM1)", generic_name: "Trastuzumab emtansine", strength: "100 mg", dosage_form: "Injection", route: "IV", unit: "Vial" },
    { medicine_name: "Doxorubicin", generic_name: "Doxorubicin HCl", strength: "50 mg", dosage_form: "Injection", route: "IV", unit: "Vial" },
    { medicine_name: "Cyclophosphamide", generic_name: "Cyclophosphamide", strength: "500 mg", dosage_form: "Injection", route: "IV", unit: "Vial" },
    { medicine_name: "Paclitaxel", generic_name: "Paclitaxel", strength: "260 mg", dosage_form: "Injection", route: "IV", unit: "Vial" },
    { medicine_name: "Docetaxel", generic_name: "Docetaxel", strength: "80 mg", dosage_form: "Injection", route: "IV", unit: "Vial" },
    { medicine_name: "Carboplatin", generic_name: "Carboplatin", strength: "450 mg", dosage_form: "Injection", route: "IV", unit: "Vial" },
    { medicine_name: "Tamoxifen", generic_name: "Tamoxifen Citrate", strength: "20 mg", dosage_form: "Tablet", route: "Oral", unit: "Tablet" },
    { medicine_name: "Letrozole", generic_name: "Letrozole", strength: "2.5 mg", dosage_form: "Tablet", route: "Oral", unit: "Tablet" },
    { medicine_name: "Palbociclib", generic_name: "Palbociclib", strength: "125 mg", dosage_form: "Capsule", route: "Oral", unit: "Capsule" },
    { medicine_name: "Olaparib", generic_name: "Olaparib", strength: "150 mg", dosage_form: "Tablet", route: "Oral", unit: "Tablet" },
    { medicine_name: "Pembrolizumab", generic_name: "Pembrolizumab", strength: "100 mg", dosage_form: "Injection", route: "IV", unit: "Vial" },
    { medicine_name: "Osimertinib", generic_name: "Osimertinib Mesylate", strength: "80 mg", dosage_form: "Tablet", route: "Oral", unit: "Tablet" },
    { medicine_name: "Amivantamab", generic_name: "Amivantamab", strength: "350 mg", dosage_form: "Injection", route: "IV", unit: "Vial" },
    { medicine_name: "Mobocertinib", generic_name: "Mobocertinib", strength: "40 mg", dosage_form: "Capsule", route: "Oral", unit: "Capsule" },
    { medicine_name: "Alectinib", generic_name: "Alectinib", strength: "150 mg", dosage_form: "Capsule", route: "Oral", unit: "Capsule" },
    { medicine_name: "Lorlatinib", generic_name: "Lorlatinib", strength: "100 mg", dosage_form: "Tablet", route: "Oral", unit: "Tablet" },
    { medicine_name: "Sotorasib", generic_name: "Sotorasib", strength: "120 mg", dosage_form: "Tablet", route: "Oral", unit: "Tablet" },
    { medicine_name: "Adagrasib", generic_name: "Adagrasib", strength: "200 mg", dosage_form: "Tablet", route: "Oral", unit: "Tablet" },

    // Standard premedication for taxane/monoclonal-antibody infusions
    // (corticosteroid + antihistamine + H2 blocker) - not chemo agents
    // themselves, but needed for the regimen protocol templates
    // (chemotherapy_regimen_protocol_items.drug_role = "PREMEDICATION") to
    // be clinically accurate rather than skipping premedication entirely.
    { medicine_name: "Dexamethasone", generic_name: "Dexamethasone Sodium Phosphate", strength: "8 mg", dosage_form: "Injection", route: "IV", unit: "Ampoule", category: "Corticosteroid" },
    { medicine_name: "Diphenhydramine", generic_name: "Diphenhydramine HCl", strength: "50 mg", dosage_form: "Injection", route: "IV", unit: "Ampoule", category: "Antihistamine" },
    { medicine_name: "Famotidine", generic_name: "Famotidine", strength: "20 mg", dosage_form: "Injection", route: "IV", unit: "Ampoule", category: "Gastro" },
];

function nextMedicineId(currentMax: string | null): string {

    const currentNumber = currentMax ? parseInt(currentMax.replace("MED", ""), 10) : 0;

    return "MED" + (currentNumber + 1).toString().padStart(6, "0");

}

export async function seedChemoDrugs() {

    console.log("Seeding chemotherapy drugs into medicine_master...");

    let seeded = 0;
    let skipped = 0;

    for (const drug of CHEMO_DRUGS) {

        const existing = await prisma.medicine_master.findFirst({
            where: { medicine_name: drug.medicine_name },
        });

        if (existing) {
            skipped++;
            continue;
        }

        const lastRow = await prisma.medicine_master.findFirst({
            orderBy: { medicine_id: "desc" },
            select: { medicine_id: true },
        });

        const medicineId = nextMedicineId(lastRow?.medicine_id ?? null);

        await prisma.medicine_master.create({
            data: {
                medicine_id: medicineId,
                medicine_name: drug.medicine_name,
                generic_name: drug.generic_name,
                medicine_category: drug.category ?? "Chemotherapy",
                medicine_type: drug.category ? "Premedication" : "Oncology",
                unit: drug.unit,
                strength: drug.strength,
                dosage_form: drug.dosage_form,
                route: drug.route,
                prescription_required: true,
                is_narcotic: false,
                is_high_risk: !drug.category,
            },
        });

        seeded++;

    }

    console.log(`  ${seeded} chemo drugs added, ${skipped} already present`);

}

if (require.main === module) {

    seedChemoDrugs()
        .catch((error) => {
            console.error(error);
            process.exit(1);
        })
        .finally(() => prisma.$disconnect());

}
