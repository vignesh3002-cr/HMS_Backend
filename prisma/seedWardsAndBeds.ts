import "dotenv/config";
import dns from "dns";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { generateId } from "../src/utils/idGenerator";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SEQUENCE_SETUP = [
  { entity_name: "ADMISSION", prefix: "IP" },
  { entity_name: "WARD", prefix: "WRD" },
  { entity_name: "BED", prefix: "BED" },
  { entity_name: "ADMISSION_TRANSFER", prefix: "TRF" },
];

interface WardDef {
  name: string;
  type: string;
  floor: string;
  tariff: number;
  beds: Array<{ number: string; type: string; tariff?: number }>;
}

const SAMPLE_WARDS: WardDef[] = [
  {
    name: "General Male Ward",
    type: "GENERAL",
    floor: "1st Floor",
    tariff: 800,
    beds: [
      { number: "GM-01", type: "STANDARD" },
      { number: "GM-02", type: "STANDARD" },
      { number: "GM-03", type: "STANDARD" },
      { number: "GM-04", type: "OXYGEN" },
    ],
  },
  {
    name: "General Female Ward",
    type: "GENERAL",
    floor: "1st Floor",
    tariff: 800,
    beds: [
      { number: "GF-01", type: "STANDARD" },
      { number: "GF-02", type: "STANDARD" },
      { number: "GF-03", type: "OXYGEN" },
    ],
  },
  {
    name: "Intensive Care Unit (ICU)",
    type: "ICU",
    floor: "2nd Floor",
    tariff: 4500,
    beds: [
      { number: "ICU-01", type: "VENTILATOR", tariff: 5500 },
      { number: "ICU-02", type: "VENTILATOR", tariff: 5500 },
      { number: "ICU-03", type: "MONITOR", tariff: 4500 },
    ],
  },
  {
    name: "Daycare & Chemo Ward",
    type: "DAYCARE",
    floor: "2nd Floor",
    tariff: 1200,
    beds: [
      { number: "DC-01", type: "RECLINER" },
      { number: "DC-02", type: "STANDARD" },
    ],
  },
  {
    name: "Private Deluxe Suite",
    type: "PRIVATE",
    floor: "3rd Floor",
    tariff: 3000,
    beds: [
      { number: "PVT-301", type: "DELUXE", tariff: 3000 },
      { number: "PVT-302", type: "DELUXE", tariff: 3000 },
    ],
  },
];

async function ensureTablesExist() {
  console.log("🔨 Checking & ensuring IPD tables exist in PostgreSQL...");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.ward_master (
      id BIGSERIAL PRIMARY KEY,
      ward_id VARCHAR(100) NOT NULL UNIQUE,
      branch_id VARCHAR(100) NOT NULL,
      ward_name VARCHAR(100) NOT NULL,
      ward_type VARCHAR(100) NOT NULL,
      floor VARCHAR(100),
      total_beds INT NOT NULL DEFAULT 0,
      tariff NUMERIC(10, 2),
      active_status SMALLINT DEFAULT 1,
      created_by VARCHAR(100),
      created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(100),
      updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_ward_branch FOREIGN KEY (branch_id) REFERENCES public.branch(branch_id) ON DELETE NO ACTION ON UPDATE NO ACTION
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_ward_branch ON public.ward_master(branch_id);
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.bed_master (
      id BIGSERIAL PRIMARY KEY,
      bed_id VARCHAR(100) NOT NULL UNIQUE,
      ward_id VARCHAR(100) NOT NULL,
      branch_id VARCHAR(100) NOT NULL,
      bed_number VARCHAR(100) NOT NULL,
      bed_type VARCHAR(100),
      tariff NUMERIC(10, 2),
      status VARCHAR(100) NOT NULL DEFAULT 'AVAILABLE',
      remarks TEXT,
      active_status SMALLINT DEFAULT 1,
      created_by VARCHAR(100),
      created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(100),
      updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_bed_ward FOREIGN KEY (ward_id) REFERENCES public.ward_master(ward_id) ON DELETE NO ACTION ON UPDATE NO ACTION,
      CONSTRAINT fk_bed_branch FOREIGN KEY (branch_id) REFERENCES public.branch(branch_id) ON DELETE NO ACTION ON UPDATE NO ACTION,
      CONSTRAINT uq_bed_ward_number UNIQUE (ward_id, bed_number)
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_bed_ward ON public.bed_master(ward_id);
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_bed_status ON public.bed_master(status);
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.admission (
      id BIGSERIAL PRIMARY KEY,
      admission_id VARCHAR(100) NOT NULL UNIQUE,
      ip_number VARCHAR(100) NOT NULL UNIQUE,
      patient_id VARCHAR(100) NOT NULL,
      appointment_id VARCHAR(100),
      encounter_no VARCHAR(100),
      branch_id VARCHAR(100) NOT NULL,
      department_id VARCHAR(100),
      employee_id VARCHAR(100),
      admission_type VARCHAR(100) NOT NULL,
      provisional_diagnosis TEXT,
      ward_id VARCHAR(100),
      bed_id VARCHAR(100),
      is_daycare BOOLEAN NOT NULL DEFAULT false,
      payment_mode VARCHAR(100),
      insurance_provider VARCHAR(100),
      insurance_policy_no VARCHAR(100),
      admission_date TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expected_stay_days NUMERIC(4, 2),
      discharge_date TIMESTAMP(6),
      discharge_type VARCHAR(100),
      discharge_summary TEXT,
      advance_amount NUMERIC(10, 2),
      status VARCHAR(100) NOT NULL DEFAULT 'ADMITTED',
      created_by VARCHAR(100),
      created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(100),
      updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_admission_patient FOREIGN KEY (patient_id) REFERENCES public.patient_bio_data(patient_id) ON DELETE NO ACTION ON UPDATE NO ACTION,
      CONSTRAINT fk_admission_branch FOREIGN KEY (branch_id) REFERENCES public.branch(branch_id) ON DELETE NO ACTION ON UPDATE NO ACTION,
      CONSTRAINT fk_admission_ward FOREIGN KEY (ward_id) REFERENCES public.ward_master(ward_id) ON DELETE NO ACTION ON UPDATE NO ACTION,
      CONSTRAINT fk_admission_bed FOREIGN KEY (bed_id) REFERENCES public.bed_master(bed_id) ON DELETE NO ACTION ON UPDATE NO ACTION
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_admission_patient ON public.admission(patient_id);
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_admission_appointment ON public.admission(appointment_id);
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_admission_bed_status ON public.admission(bed_id, status);
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_admission_branch ON public.admission(branch_id);
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.admission_transfer_log (
      id BIGSERIAL PRIMARY KEY,
      transfer_log_id VARCHAR(100) NOT NULL UNIQUE,
      admission_id VARCHAR(100) NOT NULL,
      from_ward_id VARCHAR(100),
      from_bed_id VARCHAR(100),
      to_ward_id VARCHAR(100) NOT NULL,
      to_bed_id VARCHAR(100) NOT NULL,
      reason TEXT,
      transferred_by VARCHAR(100),
      transferred_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_transfer_admission FOREIGN KEY (admission_id) REFERENCES public.admission(admission_id) ON DELETE NO ACTION ON UPDATE NO ACTION
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_transfer_admission ON public.admission_transfer_log(admission_id);
  `);

  console.log("✅ Tables verified and created successfully.");
}

async function seedWardsAndBeds() {
  await ensureTablesExist();

  console.log("\n🏥 Initializing IPD sequence rows and seeding Wards & Beds...");

  // 1. Ensure id_sequences rows exist
  for (const seq of SEQUENCE_SETUP) {
    const existing = await prisma.id_sequences.findUnique({
      where: { entity_name: seq.entity_name },
    });

    if (!existing) {
      await prisma.id_sequences.create({
        data: {
          entity_name: seq.entity_name,
          prefix: seq.prefix,
          current_number: 0,
        },
      });
      console.log(`✅ Created id_sequence for ${seq.entity_name} (prefix ${seq.prefix})`);
    } else {
      console.log(`ℹ️ id_sequence for ${seq.entity_name} already exists (prefix ${existing.prefix})`);
    }
  }

  // 2. Fetch active branches
  const branches = await prisma.branch.findMany({
    where: { branch_status: "Active" },
    select: { branch_id: true, branch_name: true },
  });

  if (branches.length === 0) {
    console.warn("⚠️ No active branches found in branch table! Checking any branch...");
    const anyBranches = await prisma.branch.findMany({
      take: 1,
      select: { branch_id: true, branch_name: true },
    });
    if (anyBranches.length === 0) {
      throw new Error("No branches exist in the database. Please seed branches first.");
    }
    branches.push(...anyBranches);
  }

  console.log(`📌 Found ${branches.length} active branch(es): ${branches.map((b) => b.branch_name).join(", ")}`);

  let totalWardsCreated = 0;
  let totalBedsCreated = 0;

  // 3. For each active branch, seed sample wards and beds if not already present
  for (const branch of branches) {
    console.log(`\n🏢 Seeding for branch: ${branch.branch_name} (${branch.branch_id})`);

    for (const wardDef of SAMPLE_WARDS) {
      // Check if this ward already exists in the branch
      const existingWard = await prisma.ward_master.findFirst({
        where: {
          branch_id: branch.branch_id,
          ward_name: { equals: wardDef.name, mode: "insensitive" },
          active_status: 1,
        },
      });

      if (existingWard) {
        console.log(`  ℹ️ Ward '${wardDef.name}' already exists (${existingWard.ward_id}) - skipping creation`);
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const ward_id = await generateId(tx, "WARD");

        const ward = await tx.ward_master.create({
          data: {
            ward_id,
            branch_id: branch.branch_id,
            ward_name: wardDef.name,
            ward_type: wardDef.type,
            floor: wardDef.floor,
            total_beds: wardDef.beds.length,
            tariff: wardDef.tariff,
            active_status: 1,
            created_by: "SYSTEM_SEED",
          },
        });
        totalWardsCreated++;

        for (const bedDef of wardDef.beds) {
          const bed_id = await generateId(tx, "BED");
          await tx.bed_master.create({
            data: {
              bed_id,
              ward_id: ward.ward_id,
              branch_id: branch.branch_id,
              bed_number: bedDef.number,
              bed_type: bedDef.type,
              tariff: bedDef.tariff ?? wardDef.tariff,
              status: "AVAILABLE",
              active_status: 1,
              created_by: "SYSTEM_SEED",
            },
          });
          totalBedsCreated++;
        }

        console.log(`  ✅ Created ward '${ward.ward_name}' (${ward.ward_id}) with ${wardDef.beds.length} beds`);
      });
    }
  }

  console.log(`\n🎉 Seeding finished successfully!`);
  console.log(`   - New Wards Created: ${totalWardsCreated}`);
  console.log(`   - New Beds Created:  ${totalBedsCreated}`);
}

async function main() {
  try {
    await seedWardsAndBeds();
  } catch (err) {
    console.error("❌ Seeding failed:", err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();

