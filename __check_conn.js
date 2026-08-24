require("dotenv").config();
const dns = require("dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

prisma.permission.count()
  .then((c) => console.log("COUNT:", c))
  .catch((e) => {
    console.log("MESSAGE:", String(e.message).split("\n")[0]);
    const c = e.meta?.driverAdapterError?.cause;
    console.log("CAUSE:", JSON.stringify(c, null, 2));
  })
  .finally(() => prisma.$disconnect());
