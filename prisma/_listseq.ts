import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
    const rows = await prisma.id_sequences.findMany({
        select: { entity_name: true, prefix: true, current_number: true },
        orderBy: { entity_name: "asc" },
    });
    console.log(rows.map((x) => `${x.entity_name}=${x.prefix}(${x.current_number})`).join("\n"));
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());