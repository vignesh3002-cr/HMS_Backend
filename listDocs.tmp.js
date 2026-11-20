require("dotenv").config({ quiet: true });
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const b = new URL(process.env.DATABASE_URL);
const u = new URL(process.env.DATABASE_URL);
u.hostname = "aws-0-ap-southeast-1.pooler.supabase.com";
u.username = "postgres." + b.hostname.split(".")[1];
const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: u.toString() }) });
(async () => {
  const maps = await p.user_branch_mapping.findMany({ where: { status: 1 }, take: 200 });
  const ids = [...new Set(maps.map(m => m.user_id))];
  const users = await p.user_table.findMany({ where: { user_id: { in: ids }, role_type: "DOCTOR", user_status: 1 }, take: 20 });
  for (const usr of users) {
    const m = maps.find(x => x.user_id === usr.user_id);
    const emp = await p.employees.findFirst({ where: { user_id: usr.user_id } });
    console.log(usr.username, usr.user_id, m?.branch_id, emp?.employee_id);
  }
  await p.$disconnect();
})();
