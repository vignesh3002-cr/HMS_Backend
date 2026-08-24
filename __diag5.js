require("dotenv").config();
const jwt = require("jsonwebtoken");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const BASE = "http://localhost:5000/api";

(async () => {
  // find a doctor user (DOC034)
  const doc = await prisma.employees.findUnique({
    where: { employee_id: "DOC034" },
    include: { user_table: true },
  });
  const u = doc.user_table;
  console.log("DOCTOR USER:", u.user_id, u.username, u.role_type);

  const token = jwt.sign(
    {
      id: u.user_id,
      user_id: u.user_id,
      employee_id: doc.employee_id,
      username: u.username,
      role: u.role_type,
      hospital_id: u.hospital_id,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  const headers = {
    Authorization: `Bearer ${token}`,
    "x-branch-id": "BRA005",
  };

  async function call(url) {
    const res = await fetch(BASE + url, { headers });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  }

  for (const pid of ["PAT008", "PAT011"]) {
    console.log(`\n===== ${pid} =====`);
    const stg = await call(`/oncology/staging-details?patient_id=${pid}&limit=1&branchId=BRA005`);
    console.log("staging status:", stg.status);
    const rows = stg.body?.data ?? [];
    console.log("staging rows:", rows.length, rows[0]?.staging_detail_id ?? "-");
    if (!rows[0]) continue;

    const prev = await call(`/chemotherapy/plans/preview?staging_detail_id=${encodeURIComponent(rows[0].staging_detail_id)}`);
    console.log("preview status:", prev.status);
    console.log("preview body:", JSON.stringify(prev.body)?.slice(0, 600));
  }

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error("ERR:", e.message);
  await prisma.$disconnect();
  process.exit(1);
});
