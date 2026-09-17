import prisma from "../src/config/prisma";

async function main() {
  console.log("Creating chemotherapy_protocol_cancers table if not exists...");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS chemotherapy_protocol_cancers (
      id BIGSERIAL PRIMARY KEY,
      protocol_id VARCHAR(100) NOT NULL REFERENCES chemotherapy_regimen_protocol(protocol_id) ON DELETE CASCADE,
      cancer_type_id VARCHAR(100) NOT NULL REFERENCES cancer_types(cancer_type_id),
      subtype_id VARCHAR(100) REFERENCES cancer_subtypes(subtype_id),
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
      active_status SMALLINT DEFAULT 1,
      CONSTRAINT uq_protocol_cancer_subtype UNIQUE (protocol_id, cancer_type_id, subtype_id)
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_protocol_cancers_proto ON chemotherapy_protocol_cancers(protocol_id);
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_protocol_cancers_type ON chemotherapy_protocol_cancers(cancer_type_id);
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_protocol_cancers_sub ON chemotherapy_protocol_cancers(subtype_id);
  `);

  console.log("Backfilling existing protocols into chemotherapy_protocol_cancers...");
  const backfillResult = await prisma.$executeRawUnsafe(`
    INSERT INTO chemotherapy_protocol_cancers (protocol_id, cancer_type_id, subtype_id)
    SELECT protocol_id, cancer_type_id, subtype_id
    FROM chemotherapy_regimen_protocol
    WHERE cancer_type_id IS NOT NULL
    ON CONFLICT (protocol_id, cancer_type_id, subtype_id) DO NOTHING;
  `);
  console.log("Backfill result:", backfillResult);

  const count: any = await prisma.$queryRawUnsafe(`
    SELECT count(*)::int as count FROM chemotherapy_protocol_cancers;
  `);
  console.log("Total rows in chemotherapy_protocol_cancers:", count);

  await prisma.$disconnect();
}

main().catch(console.error);

