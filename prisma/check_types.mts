import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
async function main() {
  const types = await prisma.cancer_types.findMany({ select: { cancer_type_id: true, cancer_type: true } });
  console.log(types.map(t => `${t.cancer_type_id}|${t.cancer_type}`).join("\n"));
}
main().finally(() => prisma.$disconnect());
