import "dotenv/config";
import prisma from "../src/config/prisma";
import { ENTITY_TARGET } from "../src/utils/idGenerator";

// Audits every mapped entity: compares id_sequences.current_number with the
// highest numeric id actually present in the table. A negative drift means the
// sequence is behind the data (the next generated id would collide); a
// positive drift is just a harmless gap. Run with:
//   npx ts-node prisma/checkSequences.ts
async function main() {
    const sequences = await prisma.id_sequences.findMany({
        orderBy: { entity_name: "asc" }
    });

    const behind: string[] = [];
    let checked = 0;

    for (const sequence of sequences) {
        const target = ENTITY_TARGET[sequence.entity_name];

        if (!target) {
            continue;
        }

        checked += 1;

        const prefix = sequence.prefix ?? "";
        const rows = await prisma.$queryRawUnsafe<any[]>(`
            SELECT COALESCE(MAX(SUBSTRING(${target.column} FROM ${prefix.length + 1})::bigint), 0) AS max_number
            FROM ${target.table}
            WHERE ${target.column} ~ '^${prefix.replace(/'/g, "''")}[0-9]+$'
        `);

        const maxNumber = Number(rows[0]?.max_number ?? 0);
        const current = Number(sequence.current_number);
        const drift = current - maxNumber;

        const status = drift < 0 ? "BEHIND" : "ok";

        if (drift < 0) {
            behind.push(sequence.entity_name);
        }

        console.log(
            `${status.padEnd(7)} ${sequence.entity_name.padEnd(32)} seq=${current} data=${maxNumber} drift=${drift}`
        );
    }

    console.log(`\nchecked ${checked} mapped entities`);

    if (behind.length > 0) {
        console.error(`\nSequences behind their data: ${behind.join(", ")}`);
        process.exitCode = 1;
    } else {
        console.log("All mapped sequences are in sync.");
    }

    await prisma.$disconnect();
}

main().catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
    await prisma.$disconnect();
});
