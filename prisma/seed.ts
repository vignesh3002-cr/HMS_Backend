import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding id_sequences...");

  const sequences = [
    { entity_name: "USER", prefix: "USR", current_number: 0, description: "User ID sequence" },
    { entity_name: "EMPLOYEE", prefix: "EMP", current_number: 0, description: "Employee ID sequence" },
    { entity_name: "DOCTOR", prefix: "DOC", current_number: 0, description: "Doctor ID sequence" },
    { entity_name: "BRANCH_ADMIN", prefix: "BAD", current_number: 0, description: "Branch Admin ID sequence" },
    { entity_name: "BRANCH", prefix: "BRN", current_number: 0, description: "Branch ID sequence" },
    { entity_name: "PATIENT", prefix: "PAT", current_number: 0, description: "Patient ID sequence" },
    { entity_name: "APPOINTMENT", prefix: "APT", current_number: 0, description: "Appointment ID sequence" },
    { entity_name: "ENCOUNTER", prefix: "ENC", current_number: 0, description: "Encounter ID sequence" },
    { entity_name: "PRESCRIPTION", prefix: "PRS", current_number: 0, description: "Prescription ID sequence" },
    { entity_name: "PRESCRIPTION_ITEM", prefix: "PRI", current_number: 0, description: "Prescription Item ID sequence" },
    { entity_name: "DEPARTMENT", prefix: "DEP", current_number: 0, description: "Department ID sequence" },
    { entity_name: "CHEMO", prefix: "CHM", current_number: 0, description: "Chemotherapy ID sequence" },
  ];

  for (const seq of sequences) {
    await prisma.id_sequences.upsert({
      where: { entity_name: seq.entity_name },
      update: { prefix: seq.prefix, current_number: seq.current_number, description: seq.description },
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