import "dotenv/config";
import dns from "dns";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const perm = await prisma.permission.findUnique({
    where: { key: "patient.delete" },
  });

  if (!perm) {
    console.log("permission 'patient.delete' not found - nothing to do");
    return;
  }

  const grants = await prisma.rolePermission.deleteMany({
    where: { permission_id: perm.id },
  });

  await prisma.permission.delete({ where: { id: perm.id } });

  console.log(`deleted permission 'patient.delete' and ${grants.count} role grant(s)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
