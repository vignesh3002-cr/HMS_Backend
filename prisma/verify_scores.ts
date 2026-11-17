import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
async function main() {
  const [scores, vars, groups, stagingCols] = await Promise.all([
    prisma.cancer_score.count(),
    prisma.cancer_score_variable.count(),
    prisma.cancer_score_group.count(),
    prisma.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_name='oncology_staging_detail' AND column_name LIKE 'score_%' ORDER BY column_name`),
  ]);
  console.log("cancer_score rows:", scores);
  console.log("cancer_score_variable rows:", vars);
  console.log("cancer_score_group rows:", groups);
  console.log("staging score columns:", JSON.stringify(stagingCols));
  // sample Breast score
  const b01 = await prisma.cancer_score.findFirst({ where: { score_id: "B01" } });
  console.log("B01:", b01 ? { score_id: b01.score_id, name: b01.score_system, type_id: b01.cancer_type_id } : null);
  const b01vars = await prisma.cancer_score_variable.findMany({ where: { score_id: "B01" } });
  console.log("B01 variables:", b01vars.map(v => `${v.variable_name} (${v.source})`));
  const b01groups = await prisma.cancer_score_group.findMany({ where: { score_id: "B01" } });
  console.log("B01 groups:", b01groups.map(g => `${g.group_range} => ${g.meaning}`));
}
main().finally(() => prisma.$disconnect());
