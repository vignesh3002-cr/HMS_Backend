import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// One-time setup for the IPD admission / ward & bed workflow:
//   1. id_sequences rows for the ID generators used by admission / ward /
//      bed / admission transfer. Without these rows, generateAppointmentId /
//      generateId(tx, "ADMISSION") etc. crash on a missing sequence.
//   2. (Optional) One default ward + beds per active branch so the Inpatient
//      booking form / ward admin has something to work with immediately.
//        WARD      -> prefix WRD
//        BED       -> prefix BED
//        ADMISSION -> prefix IP (ip_number) and ADM (admission_id shares
//                     sequence with prefix "ADM" is separate - NOT needed,
//                     admission_id is autoincrement-backed string? NO - see
//                     idGenerator: admission_id uses the sequence below).
//        ADMISSION_TRANSFER -> prefix TRF
//
// NOTE: admission_id / ip_number / ward_id / bed_id / transfer_log_id are
// all generated via idGenerator.ts generateId() inside a transaction, so the
// only hard requirement here is that each entity has a matching id_sequences
// row (prefix + current_number). The sample ward/bed seeding is convenience
// only and can be safely removed.
async function main() {

    const sequenceSetup = [
        { entity_name: "ADMISSION", prefix: "IP" },
        { entity_name: "WARD", prefix: "WRD" },
        { entity_name: "BED", prefix: "BED" },
        { entity_name: "ADMISSION_TRANSFER", prefix: "TRF" }
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

    const branches = await prisma.branch.findMany({
        where: { active_status: { not: 0 } },
        select: { branch_id: true, branch_name: true }
    });

    for (const branch of branches) {

        const existingWard = await prisma.ward_master.findFirst({
            where: { branch_id: branch.branch_id }
        });

        if (existingWard) {
            console.log(`[ward_master] ${branch.branch_name} already has a ward - skipped`);
            continue;
        }

        const wardId = await prisma.id_sequences.findUnique({
            where: { entity_name: "WARD" }
        });

        if (!wardId) {
            console.log(`[ward_master] sequence WARD missing - cannot seed ${branch.branch_name}`);
            continue;
        }

        await prisma.$transaction(async (tx) => {

            const ward_id = await generateIdFor(tx, "WARD");
            const createdWard = await tx.ward_master.create({
                data: {
                    ward_id,
                    branch_id: branch.branch_id,
                    ward_name: "General Ward",
                    ward_type: "General",
                    total_beds: 4,
                    created_by: "SYSTEM"
                }
            });

            for (let i = 1; i <= 4; i++) {
                const bed_id = await generateIdFor(tx, "BED");
                await tx.bed_master.create({
                    data: {
                        bed_id,
                        ward_id,
                        branch_id: branch.branch_id,
                        bed_number: `G-${i}`,
                        bed_type: "General",
                        status: "AVAILABLE",
                        active_status: 1,
                        created_by: "SYSTEM"
                    }
                });
            }

            console.log(`[ward_master] created ${createdWard.ward_id} + 4 beds for ${branch.branch_name}`);

        });

    }

    const totals = await prisma.id_sequences.findMany({
        where: { entity_name: { in: ["ADMISSION", "WARD", "BED", "ADMISSION_TRANSFER"] } },
        orderBy: { entity_name: "asc" }
    });

    for (const t of totals) {
        console.log(`[id_sequences] ${t.entity_name}: prefix=${t.prefix} current_number=${t.current_number}`);
    }

}

async function generateIdFor(tx: Prisma.TransactionClient, entity: string) {
    return idGenerator.generateId(tx, entity);
}

import { generateId } from "../src/utils/idGenerator";

main()
    .catch((error) => {

        console.error("[seedIpdSetup] failed:", error);
        process.exitCode = 1;

    })
    .finally(async () => {

        await prisma.$disconnect();

    });
