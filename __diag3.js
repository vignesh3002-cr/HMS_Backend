require("dotenv").config();
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

BigInt.prototype.toJSON = function () { return this.toString(); };
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

(async () => {
  const rows = await prisma.oncology_staging_detail.findMany({
    orderBy: { created_at: "desc" },
    take: 10,
    select: {
      id: true,
      patient_history_id: true,
      branch_id: true,
      created_at: true,
    },
  });
  console.log("LATEST STAGING ROWS (id, patientHistoryId, branch):");
  for (const r of rows) console.log(` id=${r.id} hist=${r.patient_history_id} br=${r.branch_id} at=${r.created_at?.toISOString()}`);

  // Map: patient_id comes via patient_history -> user? check relation
  const openEnc = await prisma.encounter.findMany({
    where: { status: "OPEN" },
    select: { patient_id: true },
    distinct: ["patient_id"],
  });
  const pids = openEnc.map(p => p.patient_id);
  console.log("\nOPEN-ENCOUNTER PATIENTS:", pids.join(", "));

  for (const pid of pids) {
    const stg = await prisma.oncology_staging_detail.findMany({
      where: { patient_bio_data: { patient_id: pid } },
      orderBy: { created_at: "desc" },
      take: 1,
      select: { id: true, created_at: true, branch_id: true },
    });
    const planCount = await prisma.chemotherapy_plan.count({
      where: { oncology_staging_detail: { patient_bio_data: { patient_id: pid } } },
    });
    console.log(` ${pid}: latestStagingId=${stg[0]?.id ?? "NONE"} br=${stg[0]?.branch_id ?? "-"} plans=${planCount}`);
  }

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error("ERR:", e.message);
  await prisma.$disconnect();
  process.exit(1);
});
