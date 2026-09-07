require("dotenv").config();
const dns = require("dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

function makeClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

async function main() {
  let prisma;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      prisma = makeClient();
      const perms = await prisma.permission.findMany({ where: { key: { contains: "oncology" } } });
      console.log("ONCOLOGY PERMISSIONS IN DB:", JSON.stringify(perms.map((p) => ({ key: p.key, id: p.id, active: p.is_active }))));

      const diagRead = perms.find((p) => p.key === "oncology.diagnosis.read");
      if (diagRead) {
        const grants = await prisma.rolePermission.findMany({
          where: { permission_id: diagRead.id, revoked_at: null },
        });
        console.log("GRANTS FOR oncology.diagnosis.read:", JSON.stringify(grants.map((g) => g.role_type)));
        const revoked = await prisma.rolePermission.findMany({
          where: { permission_id: diagRead.id, NOT: { revoked_at: null } },
        });
        console.log("REVOKED GRANTS:", JSON.stringify(revoked.map((r) => ({ role: r.role_type }))));
      }

      const total = await prisma.permission.count();
      console.log("TOTAL PERMISSIONS IN DB:", total);
      await prisma.$disconnect();
      return;
    } catch (e) {
      const cause = e.meta?.driverAdapterError?.cause;
      console.log(`attempt ${attempt} failed:`, String(e.message).split("\n")[0], "| CAUSE:", JSON.stringify(cause));
      if (prisma) { try { await prisma.$disconnect(); } catch {} }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  console.log("ALL ATTEMPTS FAILED");
}

main();
