import prisma from "./src/config/prisma";

async function main() {
  const dischargeGens: any[] = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT mm.medicine_id, mm.medicine_name, mm.generic_name, mm.generic_id, mm.medicine_category
    FROM chemotherapy_discharge_instructions cdi
    JOIN medicine_master mm ON cdi.medicine_id = mm.medicine_id
    WHERE cdi.active_status = 1 AND (mm.generic_id IS NULL OR mm.generic_id = 'GEN_NOT_SPECIFIED')
    LIMIT 20
  `);
  console.log("Distinct uncatalogued discharge medicines:", dischargeGens);
}

main().catch(console.error).finally(() => prisma.$disconnect());

