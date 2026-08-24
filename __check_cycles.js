require("dotenv").config();
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

(async () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const cycles = await prisma.chemotherapy_cycle.findMany({
    select: {
      chemotherapy_cycle_id: true,
      chemotherapy_plan_id: true,
      cycle_number: true,
      cycle_day: true,
      active_status: true,
      deleted_flag: true,
    },
    take: 20,
  });
  console.log(JSON.stringify(cycles, null, 1));
  await prisma.$disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
