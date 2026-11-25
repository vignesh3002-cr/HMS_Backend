import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Loads gene_master from the Genomics master workbook export
// (EMR_IHC_Genomics_Master.v2.xlsx -> Gene_Master tab), saved as
// prisma/data/geneMaster.json so the repo does not depend on the .xlsx.
//
// The list is data, not code: the admin screen edits these rows afterwards,
// and re-running this seed only refreshes order/source/spec site - it never
// deletes a row an admin added.

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

interface GeneMasterRow {
    cancer_site: string;
    scope: "SOMATIC" | "GERMLINE";
    gene_symbol: string;
    sort_order: number;
    source: string | null;
    spec_site: string | null;
    emr_cancer_types: string[];
}

const esc = (value: string | null | undefined) =>
    value == null ? "NULL" : `'${String(value).replace(/'/g, "''")}'`;

async function main() {
    const file = path.join(__dirname, "data", "geneMaster.json");
    const rows: GeneMasterRow[] = JSON.parse(fs.readFileSync(file, "utf-8"));

    const existing = await prisma.gene_master.findMany({
        select: { gene_master_id: true, cancer_site: true, scope: true, gene_symbol: true },
    });

    const idByKey = new Map<string, string>();
    let maxNumber = 0;
    for (const row of existing) {
        idByKey.set(`${row.cancer_site}|${row.scope}|${row.gene_symbol}`, row.gene_master_id);
        const numeric = Number(String(row.gene_master_id).replace(/^GM/, ""));
        if (Number.isFinite(numeric) && numeric > maxNumber) maxNumber = numeric;
    }

    let inserted = 0;
    const values: string[] = [];

    for (const row of rows) {
        const key = `${row.cancer_site}|${row.scope}|${row.gene_symbol}`;
        let id = idByKey.get(key);
        if (!id) {
            maxNumber += 1;
            id = `GM${String(maxNumber).padStart(5, "0")}`;
            idByKey.set(key, id);
            inserted += 1;
        }
        values.push(
            `(${esc(id)}, ${esc(row.cancer_site)}, ${esc(row.scope)}::genomic_scope, ` +
            `${esc(row.gene_symbol)}, ${row.sort_order}, ${esc(row.source)}, ` +
            `${esc(row.spec_site)}, true)`
        );
    }

    for (let i = 0; i < values.length; i += 200) {
        const chunk = values.slice(i, i + 200).join(",\n");
        await prisma.$executeRawUnsafe(`
            INSERT INTO public.gene_master
                (gene_master_id, cancer_site, scope, gene_symbol, sort_order, source, spec_site, active)
            VALUES ${chunk}
            ON CONFLICT (cancer_site, scope, gene_symbol) DO UPDATE SET
                sort_order = EXCLUDED.sort_order,
                source = EXCLUDED.source,
                spec_site = EXCLUDED.spec_site,
                active = true,
                updated_at = now()
        `);
    }

    // Keep the sequence ahead of any ids this seed wrote directly.
    await prisma.$executeRawUnsafe(`
        UPDATE public.id_sequences
        SET current_number = GREATEST(current_number, (
                SELECT COALESCE(MAX(substring(gene_master_id FROM 3)::int), 0)
                FROM public.gene_master
            )),
            updated_at = now()
        WHERE entity_name = 'GENE_MASTER'
    `);

    const [totals, lung, breast] = await Promise.all([
        prisma.gene_master.groupBy({ by: ["scope"], _count: { _all: true } }),
        prisma.gene_master.findMany({
            where: { cancer_site: "Lung", scope: "SOMATIC", active: true },
            orderBy: { sort_order: "asc" },
            select: { gene_symbol: true },
        }),
        prisma.gene_master.findMany({
            where: { cancer_site: "Breast", scope: "GERMLINE", active: true },
            orderBy: { sort_order: "asc" },
            select: { gene_symbol: true },
        }),
    ]);

    console.log(`gene_master: ${rows.length} rows (${inserted} new)`);
    for (const total of totals) {
        console.log(`  ${total.scope}: ${total._count._all}`);
    }
    console.log(`  Lung + SOMATIC (${lung.length}): ${lung.map((r) => r.gene_symbol).join(", ")}`);
    console.log(`  Breast + GERMLINE (${breast.length}): ${breast.map((r) => r.gene_symbol).join(", ")}`);
}

main()
    .catch((error) => {
        console.error("Genomics seed failed:", error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
