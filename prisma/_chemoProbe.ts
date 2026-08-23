import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {

    const users = await prisma.$queryRawUnsafe(`SELECT user_id, username, role_type FROM user_table LIMIT 5`);
    console.log("USERS:", JSON.stringify(users, null, 1));

}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });