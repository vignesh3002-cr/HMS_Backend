require("dotenv").config({ quiet: true });
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const b = new URL(process.env.DATABASE_URL);
const u = new URL(process.env.DATABASE_URL);
u.hostname = "aws-0-ap-southeast-1.pooler.supabase.com";
u.username = "postgres." + b.hostname.split(".")[1];
const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: u.toString() }) });
(async () => {
  const d = await p.oncology_staging_detail.findFirst({ where: { encounter_no: "ENCQA1" } });
  console.log("detail", d ? { id: d.staging_detail_id, patient: d.patient_id, type: d.cancer_type_id, stage: d.clinical_stage, t: d.t_stage, n: d.n_stage, m: d.m_stage, form: d.form_state ? "yes" : "no" } : null);
  if (d) {
    const recs = await p.oncology_stage_record.findMany({ where: { staging_detail_id: d.staging_detail_id }, orderBy: { id: "desc" } });
    console.log(recs.map(r => ({ id: r.stage_record_id, ctx: r.context, t: r.t_code, n: r.n_code, m: r.m_code, derived: r.derived_stage, final: r.final_stage, active: r.is_active, date: r.stage_date })));
  }
  await p.$disconnect();
})();
