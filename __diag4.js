require("dotenv").config();
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

(async () => {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT rp.role_type, p.key AS permission_key
    FROM "RolePermission" rp
    JOIN "Permission" p ON p.id = rp.permission_id
    WHERE (p.key LIKE 'oncology%' OR p.key LIKE 'chemo%')
      AND rp.revoked_at IS NULL
    ORDER BY rp.role_type, p.key
  `);
  for (const r of rows) console.log(`${r.role_type}: ${r.permission_key}`);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error("ERR:", e.message);
  await prisma.$disconnect();
  process.exit(1);
});
