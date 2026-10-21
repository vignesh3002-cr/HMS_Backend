import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function run() {
    const sqlFile = process.argv[2] || "20261014_staff_duty_roster.sql";
    const sqlPath = path.join(__dirname, "sql", sqlFile);
    console.log("Running migration:", sqlPath);
    const sql = fs.readFileSync(sqlPath, "utf-8");
    await prisma.$executeRawUnsafe(sql);
    console.log("Migration executed successfully!");
}

run()
    .catch((err) => {
        console.error("Migration failed:", err);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());

