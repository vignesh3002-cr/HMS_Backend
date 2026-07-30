import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

async function main() {
  console.log("Seeding id_sequences...");

  const sequences = [
    { entity_name: "USER", prefix: "USR", current_number: 0 },
    { entity_name: "EMPLOYEE", prefix: "EMP", current_number: 0 },
    { entity_name: "DOCTOR", prefix: "DOC", current_number: 0 },
    { entity_name: "BRANCH_ADMIN", prefix: "BAD", current_number: 0 },
    { entity_name: "BRANCH", prefix: "BRN", current_number: 0 },
    { entity_name: "PATIENT", prefix: "PAT", current_number: 0 },
    { entity_name: "APPOINTMENT", prefix: "APT", current_number: 0 },
    { entity_name: "ENCOUNTER", prefix: "ENC", current_number: 0 },
    { entity_name: "PRESCRIPTION", prefix: "PRS", current_number: 0 },
    { entity_name: "PRESCRIPTION_ITEM", prefix: "PRI", current_number: 0 },
    { entity_name: "DEPARTMENT", prefix: "DEP", current_number: 0 },
    { entity_name: "CHEMO", prefix: "CHM", current_number: 0 },
    { entity_name: "DOCTOR_TRANSFER", prefix: "DTR", current_number: 0 },
    { entity_name: "RESCHEDULE_QUEUE", prefix: "RSQ", current_number: 0 },
    { entity_name: "NOTIFICATION", prefix: "NTF", current_number: 0 },
  ];

  for (const seq of sequences) {
    await prisma.id_sequences.upsert({
      where: { entity_name: seq.entity_name },
      update: { prefix: seq.prefix, current_number: seq.current_number },
      create: seq,
    });
    console.log(`  ✓ ${seq.entity_name} (${seq.prefix})`);
  }

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });