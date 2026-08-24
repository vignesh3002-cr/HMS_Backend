import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// One-time setup for the organization-specific personalized regimen protocol
// workflow:
//   1. id_sequences rows for the day and dilution ID generators (REGIMEN_PROTOCOL_DAY
//      with prefix CPD, REGIMEN_PROTOCOL_DILUTION with prefix RPD). Without these
//      rows generateId(tx, "REGIMEN_PROTOCOL_DAY")/("REGIMEN_PROTOCOL_DILUTION")
//      would crash on a missing sequence.
//   2. Backfill protocol_type = 'GENERIC' on every existing protocol row where it
//      is NULL - every pre-existing record is a globally-shared generic template
//      (personalized copies are only ever created by the personalize API).
async function main() {

    const sequenceSetup = [
        { entity_name: "REGIMEN_PROTOCOL_DAY", prefix: "CPD" },
        { entity_name: "REGIMEN_PROTOCOL_DILUTION", prefix: "RPD" }
    ];

    for (const seq of sequenceSetup) {

        const existing = await prisma.id_sequences.findUnique({
            where: { entity_name: seq.entity_name }
        });

        if (existing) {
            console.log(`[id_sequences] ${seq.entity_name} already exists (prefix ${existing.prefix}, current ${existing.current_number}) - skipped`);
            continue;
        }

        await prisma.id_sequences.create({
            data: {
                entity_name: seq.entity_name,
                prefix: seq.prefix,
                current_number: 0
            }
        });

        console.log(`[id_sequences] created ${seq.entity_name} with prefix ${seq.prefix}`);

    }

    const backfill = await prisma.chemotherapy_regimen_protocol.updateMany({
        where: { protocol_type: null },
        data: { protocol_type: "GENERIC" }
    });

    console.log(`[protocol_type] backfilled ${backfill.count} row(s) to GENERIC`);

    // Existing rows created before this workflow normalize protocol_type to the
    // exact values the API compares against (e.g. "Personalized" -> "PERSONALIZED").
    const normalized = await prisma.chemotherapy_regimen_protocol.updateMany({
        where: { protocol_type: { not: null, notIn: ["GENERIC", "PERSONALIZED"] } },
        data: { protocol_type: "PERSONALIZED" }
    });

    console.log(`[protocol_type] normalized ${normalized.count} row(s) to PERSONALIZED`);

    const totals = await prisma.id_sequences.findMany({
        where: { entity_name: { in: ["REGIMEN_PROTOCOL", "REGIMEN_PROTOCOL_ITEM", "REGIMEN_PROTOCOL_DAY", "REGIMEN_PROTOCOL_DILUTION"] } },
        orderBy: { entity_name: "asc" }
    });

    for (const t of totals) {
        console.log(`[id_sequences] ${t.entity_name}: prefix=${t.prefix} current_number=${t.current_number}`);
    }

}

main()
    .catch((error) => {
        console.error("[seedPersonalizedProtocolSetup] failed:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
