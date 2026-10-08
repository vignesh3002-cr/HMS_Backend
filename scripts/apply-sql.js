// One-off: apply a prisma/sql file with the same DATABASE_URL the backend uses.
// dotenv is already a backend dependency, so this reads the same .env.
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const sqlFile = process.argv[2];

if (!sqlFile) {
    console.error("usage: node apply-sql.js <file.sql>");
    process.exit(1);
}

(async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });

    await client.connect();

    try {
        const sql = fs.readFileSync(sqlFile, "utf8");

        // The file wraps itself in BEGIN/COMMIT.
        await client.query(sql);

        console.log(`applied ${path.basename(sqlFile)}`);
    } catch (error) {
        console.error("FAILED:", error.message);
        process.exitCode = 1;
    } finally {
        await client.end();
    }
})();
