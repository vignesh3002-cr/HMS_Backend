require("dotenv").config();
const jwt = require("jsonwebtoken");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

BigInt.prototype.toJSON = function () { return this.toString(); };
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const BASE = "http://localhost:5000/api";

(async () => {
  const doc = await prisma.employees.findUnique({
    where: { employee_id: "DOC034" },
    include: { user_table: true },
  });
  const u = doc.user_table;
  const token = jwt.sign(
    { id: u.user_id, user_id: u.user_id, employee_id: doc.employee_id, username: u.username, role: u.role_type, hospital_id: u.hospital_id },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  const res = await fetch(`${BASE}/oncology/staging-details/STD090`, {
    headers: { Authorization: `Bearer ${token}`, "x-branch-id": "BRA005" },
  });
  const body = await res.json().catch(() => null);
  console.log("STATUS:", res.status);
  console.log(JSON.stringify(body, null, 1).slice(0, 4000));

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error("ERR:", e.message);
  await prisma.$disconnect();
  process.exit(1);
});
