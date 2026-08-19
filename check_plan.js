const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const dotenv = require('dotenv');
dotenv.config();
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
(async () => {
  const plans = await prisma.chemotherapy_plan.findMany({
    take: 3,
    include: {
      chemotherapy_plan_items: {
        where: { active_status: 1 },
        include: { medicine_master: true },
      },
    },
  });
  console.log(JSON.stringify(plans, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 1));
  await prisma.$disconnect();
})().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});