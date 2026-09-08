require("dotenv").config();
const dns = require("dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);
const jwt = require("jsonwebtoken");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

function makeClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

const BASE = "http://localhost:5000/api";

async function call(url, headers) {
  try {
    const res = await fetch(BASE + url, { headers });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  } catch (e) {
    return { status: -1, body: { message: e.message } };
  }
}

async function withRetry(fn, tries = 6) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try { return await fn(); } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 1500)); }
  }
  throw lastErr;
}

(async () => {
  const prisma = await withRetry(() => makeClient());

  // find users mapped to PAT008's context; test a DOCTOR
  const docEmp = await prisma.employees.findUnique({
    where: { employee_id: "DOC034" },
    include: { user_table: true },
  });
  const u = docEmp.user_table;

  const mappings = await prisma.user_branch_mapping.findMany({
    where: { user_id: u.user_id },
  });
  console.log("USER:", u.user_id, u.username, u.role_type);
  console.log("BRANCH MAPPINGS:", JSON.stringify(mappings.map(m => ({ branch_id: m.branch_id, status: m.status }))));

  const token = jwt.sign(
    {
      id: u.user_id,
      user_id: u.user_id,
      employee_id: docEmp.employee_id,
      username: u.username,
      role: u.role_type,
      hospital_id: u.hospital_id,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  console.log("\n-- no branchId query, no x-branch-id header --");
  let r = await call(`/oncology/staging-details?patient_id=PAT008&limit=1`, { Authorization: `Bearer ${token}` });
  console.log("status:", r.status, JSON.stringify(r.body)?.slice(0, 300));

  console.log("\n-- x-branch-id BRA005 header only --");
  r = await call(`/oncology/staging-details?patient_id=PAT008&limit=1`, { Authorization: `Bearer ${token}`, "x-branch-id": "BRA005" });
  console.log("status:", r.status, JSON.stringify(r.body)?.slice(0, 300));

  await prisma.$disconnect();
})().catch((e) => { console.error("FATAL:", e?.message ?? e); process.exit(1); });
