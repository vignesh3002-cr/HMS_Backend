const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

(async () => {
  const users = await p.user_table.findMany({
    take: 10,
    orderBy: { created_at: "desc" },
    select: { user_id: true, username: true, user_status: true },
  });
  console.log(JSON.stringify(users, null, 1));

  // employees linked to users (to pick a doctor)
  const emps = await p.employee.findMany({
    take: 10,
    orderBy: { created_at: "desc" },
    select: {
      employee_id: true,
      first_name: true,
      last_name: true,
      role_type: true,
      email: null,
    },
  });
  console.log(JSON.stringify(emps, null, 1));

  await p.$disconnect();
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
