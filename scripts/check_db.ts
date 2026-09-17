import prisma from "../src/config/prisma";

async function main() {
  const res = await prisma.$queryRawUnsafe(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND (table_name LIKE '%protocol%' OR table_name LIKE '%cancer%')
    ORDER BY table_name;
  `);
  console.log("Matching tables:", res);
  await prisma.$disconnect();
}

main().catch(console.error);

