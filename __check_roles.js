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

      const diagRead = await prisma.permission.findUnique({ where: { key: "oncology.diagnosis.read" } });

      const grants = await prisma.rolePermission.findMany({
        where: { permission_id: diagRead.id, revoked_at: null },
      });
      const grantedRoles = new Set(grants.map((g) => g.role_type.toUpperCase()));

      const users = await prisma.user_table.findMany({
        select: { role_type: true },
        distinct: ["role_type"],
      });
      console.log("USER ROLES IN DB:", JSON.stringify(users.map((u) => u.role_type)));
      console.log("ROLES WITHOUT diagnosis.read:", JSON.stringify([...grantedRoles.size ? users.map((u) => u.role_type).filter((r) => !grantedRoles.has(String(r).toUpperCase())) : []]));

      // patients table for PAT008 - who treats them / which branch
      const pat = await prisma.patients.findUnique({
        where: { patient_id: "PAT008" },
        select: { patient_id: true, branch_id: true, first_name: true },
      }).catch(() => null);
      console.log("PAT008:", JSON.stringify(pat));

      await prisma.$disconnect();
      return;
    } catch (e) {
      console.log(`attempt ${attempt} failed:`, String(e.message).split("\n")[0]);
      if (prisma) { try { await prisma.$disconnect(); } catch {} }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

main();
