import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const SQL_PATH = path.join(__dirname, "sql", "20261109_score_workspace.sql");

async function main() {
    const sql = fs.readFileSync(SQL_PATH, "utf8");
    const statements = sql
        .split(";")
        .map((statement) => statement.trim())
        .filter(Boolean);

    for (const statement of statements) {
        await prisma.$executeRawUnsafe(statement);
        console.log("ok:", statement.split("\n")[0].slice(0, 70));
    }
    console.log(`Applied ${statements.length} statement(s).`);
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
