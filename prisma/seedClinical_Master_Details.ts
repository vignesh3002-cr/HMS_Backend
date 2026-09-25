import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// ---------------------------------------------------------------------------
// ECOG Performance Status Master Data
// ---------------------------------------------------------------------------
const ECOG_SCALE = [
  {
    code: "ECOG_0",
    description: "Fully active, able to carry on all pre-disease performance without restriction",
    display_order: 0,
  },
  {
    code: "ECOG_1",
    description: "Restricted in physically strenuous activity but ambulatory and able to carry out work of a light or sedentary nature",
    display_order: 1,
  },
  {
    code: "ECOG_2",
    description: "Ambulatory and capable of all selfcare but unable to carry out any work activities. Up and about more than 50% of waking hours",
    display_order: 2,
  },
  {
    code: "ECOG_3",
    description: "Capable of only limited selfcare, confined to bed or chair more than 50% of waking hours",
    display_order: 3,
  },
  {
    code: "ECOG_4",
    description: "Completely disabled. Cannot carry on any selfcare. Totally confined to bed or chair",
    display_order: 4,
  },
  {
    code: "ECOG_5",
    description: "Dead",
    display_order: 5,
  },
];

// ---------------------------------------------------------------------------
// Symptom Master Data - Common clinical symptoms for outpatient/oncology workflows
// ---------------------------------------------------------------------------
const SYMPTOM_MASTER = [
  // Respiratory
  { code: "SYM_COUGH", name: "Cough", description: "Persistent or intermittent cough", category: "Respiratory", body_system: "Respiratory" },
  { code: "SYM_DYSPNEA", name: "Shortness of breath", description: "Dyspnea / difficulty breathing", category: "Respiratory", body_system: "Respiratory" },
  { code: "SYM_WHEEZING", name: "Wheezing", description: "High-pitched whistling sound during breathing", category: "Respiratory", body_system: "Respiratory" },
  { code: "SYM_HEMOPTYSIS", name: "Hemoptysis", description: "Coughing up blood", category: "Respiratory", body_system: "Respiratory" },
  { code: "SYM_SORE_THROAT", name: "Sore throat", description: "Pharyngitis / throat pain", category: "Respiratory", body_system: "Respiratory" },
  { code: "SYM_HOARSENESS", name: "Hoarseness", description: "Voice change / dysphonia", category: "Respiratory", body_system: "Respiratory" },

  // Constitutional / General
  { code: "SYM_FEVER", name: "Fever", description: "Elevated body temperature >38°C", category: "Constitutional", body_system: "General" },
  { code: "SYM_FATIGUE", name: "Fatigue", description: "Persistent tiredness / exhaustion not relieved by rest", category: "Constitutional", body_system: "General" },
  { code: "SYM_WEAKNESS", name: "Weakness", description: "Generalized muscle weakness / asthenia", category: "Constitutional", body_system: "Musculoskeletal" },
  { code: "SYM_WEIGHT_LOSS", name: "Weight loss", description: "Unintentional weight loss", category: "Constitutional", body_system: "General" },
  { code: "SYM_WEIGHT_GAIN", name: "Weight gain", description: "Unintentional weight gain", category: "Constitutional", body_system: "General" },
  { code: "SYM_LOSS_OF_APPETITE", name: "Loss of appetite", description: "Anorexia / decreased food intake", category: "Constitutional", body_system: "Gastrointestinal" },
  { code: "SYM_NIGHT_SWEATS", name: "Night sweats", description: "Excessive sweating during sleep", category: "Constitutional", body_system: "General" },
  { code: "SYM_MALAISE", name: "Malaise", description: "General feeling of discomfort / illness", category: "Constitutional", body_system: "General" },

  // Pain
  { code: "SYM_HEADACHE", name: "Headache", description: "Cephalalgia / head pain", category: "Pain", body_system: "Neurological" },
  { code: "SYM_CHEST_PAIN", name: "Chest pain", description: "Thoracic pain / discomfort", category: "Pain", body_system: "Cardiovascular" },
  { code: "SYM_ABDOMINAL_PAIN", name: "Abdominal pain", description: "Stomach / belly pain", category: "Pain", body_system: "Gastrointestinal" },
  { code: "SYM_BACK_PAIN", name: "Back pain", description: "Dorsal / lumbar pain", category: "Pain", body_system: "Musculoskeletal" },
  { code: "SYM_JOINT_PAIN", name: "Joint pain", description: "Arthralgia", category: "Pain", body_system: "Musculoskeletal" },
  { code: "SYM_BONE_PAIN", name: "Bone pain", description: "Deep skeletal pain", category: "Pain", body_system: "Musculoskeletal" },
  { code: "SYM_MUSCLE_PAIN", name: "Muscle pain", description: "Myalgia", category: "Pain", body_system: "Musculoskeletal" },

  // Gastrointestinal
  { code: "SYM_NAUSEA", name: "Nausea", description: "Feeling of sickness with inclination to vomit", category: "Gastrointestinal", body_system: "Gastrointestinal" },
  { code: "SYM_VOMITING", name: "Vomiting", description: "Emesis / throwing up", category: "Gastrointestinal", body_system: "Gastrointestinal" },
  { code: "SYM_CONSTIPATION", name: "Constipation", description: "Infrequent or difficult bowel movements", category: "Gastrointestinal", body_system: "Gastrointestinal" },
  { code: "SYM_DIARRHEA", name: "Diarrhea", description: "Loose or watery stools", category: "Gastrointestinal", body_system: "Gastrointestinal" },
  { code: "SYM_DYSPEPSIA", name: "Indigestion", description: "Dyspepsia / upper abdominal discomfort after eating", category: "Gastrointestinal", body_system: "Gastrointestinal" },
  { code: "SYM_HEMATEMESIS", name: "Hematemesis", description: "Vomiting blood", category: "Gastrointestinal", body_system: "Gastrointestinal" },
  { code: "SYM_MELENA", name: "Melena", description: "Black tarry stools", category: "Gastrointestinal", body_system: "Gastrointestinal" },
  { code: "SYM_HEMATOCHEZIA", name: "Hematochezia", description: "Bright red blood per rectum", category: "Gastrointestinal", body_system: "Gastrointestinal" },
  { code: "SYM_DYSPHAGIA", name: "Difficulty swallowing", description: "Dysphagia", category: "Gastrointestinal", body_system: "Gastrointestinal" },
  { code: "SYM_ODYNOPHAGIA", name: "Painful swallowing", description: "Odynophagia", category: "Gastrointestinal", body_system: "Gastrointestinal" },

  // Neurological
  { code: "SYM_DIZZINESS", name: "Dizziness", description: "Lightheadedness / vertigo", category: "Neurological", body_system: "Neurological" },
  { code: "SYM_SYNCOPE", name: "Syncope", description: "Fainting / loss of consciousness", category: "Neurological", body_system: "Neurological" },
  { code: "SYM_SEIZURE", name: "Seizure", description: "Convulsion / fit", category: "Neurological", body_system: "Neurological" },
  { code: "SYM_TREMOR", name: "Tremor", description: "Involuntary shaking", category: "Neurological", body_system: "Neurological" },
  { code: "SYM_NUMBNESS", name: "Numbness", description: "Paresthesia / loss of sensation", category: "Neurological", body_system: "Neurological" },
  { code: "SYM_TINGLING", name: "Tingling", description: "Paresthesia / pins and needles sensation", category: "Neurological", body_system: "Neurological" },
  { code: "SYM_MEMORY_LOSS", name: "Memory loss", description: "Cognitive impairment / forgetfulness", category: "Neurological", body_system: "Neurological" },
  { code: "SYM_CONFUSION", name: "Confusion", description: "Altered mental status / disorientation", category: "Neurological", body_system: "Neurological" },

  // Cardiovascular
  { code: "SYM_PALPITATIONS", name: "Palpitations", description: "Awareness of heartbeat / irregular heartbeat", category: "Cardiovascular", body_system: "Cardiovascular" },
  { code: "SYM_EDEMA", name: "Swelling / Edema", description: "Peripheral or generalized swelling", category: "Cardiovascular", body_system: "Cardiovascular" },
  { code: "SYM_CYANOSIS", name: "Cyanosis", description: "Bluish discoloration of skin/mucous membranes", category: "Cardiovascular", body_system: "Cardiovascular" },

  // Genitourinary
  { code: "SYM_DYSURIA", name: "Painful urination", description: "Dysuria", category: "Genitourinary", body_system: "Genitourinary" },
  { code: "SYM_HEMATURIA", name: "Blood in urine", description: "Hematuria", category: "Genitourinary", body_system: "Genitourinary" },
  { code: "SYM_FREQUENCY", name: "Urinary frequency", description: "Frequent urination", category: "Genitourinary", body_system: "Genitourinary" },
  { code: "SYM_URGENCY", name: "Urinary urgency", description: "Sudden compelling urge to urinate", category: "Genitourinary", body_system: "Genitourinary" },
  { code: "SYM_OLIGURIA", name: "Decreased urine output", description: "Oliguria", category: "Genitourinary", body_system: "Genitourinary" },
  { code: "SYM_POLYURIA", name: "Excessive urine output", description: "Polyuria", category: "Genitourinary", body_system: "Genitourinary" },
  { code: "SYM_INCONTINENCE", name: "Urinary incontinence", description: "Involuntary leakage of urine", category: "Genitourinary", body_system: "Genitourinary" },

  // Dermatological
  { code: "SYM_RASH", name: "Rash", description: "Skin eruption / exanthem", category: "Dermatological", body_system: "Integumentary" },
  { code: "SYM_PRURITUS", name: "Itching", description: "Pruritus", category: "Dermatological", body_system: "Integumentary" },
  { code: "SYM_URTICARIA", name: "Hives", description: "Urticaria / wheals", category: "Dermatological", body_system: "Integumentary" },
  { code: "SYM_ALOPECIA", name: "Hair loss", description: "Alopecia", category: "Dermatological", body_system: "Integumentary" },
  { code: "SYM_SKIN_LESION", name: "Skin lesion", description: "Abnormal skin growth / ulcer / nodule", category: "Dermatological", body_system: "Integumentary" },

  // Hematological / Oncology-specific
  { code: "SYM_EASY_BRUISING", name: "Easy bruising", description: "Ecchymosis / spontaneous bruising", category: "Hematological", body_system: "Hematological" },
  { code: "SYM_BLEEDING_GUMS", name: "Bleeding gums", description: "Gingival bleeding", category: "Hematological", body_system: "Hematological" },
  { code: "SYM_EPISTAXIS", name: "Nosebleed", description: "Epistaxis", category: "Hematological", body_system: "Hematological" },
  { code: "SYM_PETECHIAE", name: "Petechiae", description: "Pinpoint red/purple spots on skin", category: "Hematological", body_system: "Hematological" },
  { code: "SYM_LYMPHADENOPATHY", name: "Swollen lymph nodes", description: "Lymphadenopathy", category: "Hematological", body_system: "Lymphatic" },

  // Psychiatric
  { code: "SYM_ANXIETY", name: "Anxiety", description: "Excessive worry / nervousness", category: "Psychiatric", body_system: "Psychiatric" },
  { code: "SYM_DEPRESSION", name: "Depression", description: "Low mood / anhedonia", category: "Psychiatric", body_system: "Psychiatric" },
  { code: "SYM_INSOMNIA", name: "Insomnia", description: "Difficulty sleeping", category: "Psychiatric", body_system: "Psychiatric" },

  // Oncology treatment-related
  { code: "SYM_CHEMO_NEUROPATHY", name: "Chemotherapy-induced neuropathy", description: "Peripheral neuropathy from chemotherapy", category: "Treatment-related", body_system: "Neurological" },
  { code: "SYM_HAND_FOOT_SYNDROME", name: "Hand-foot syndrome", description: "Palmar-plantar erythrodysesthesia", category: "Treatment-related", body_system: "Dermatological" },
  { code: "SYM_MUCOSITIS", name: "Mucositis", description: "Oral / GI mucosal inflammation", category: "Treatment-related", body_system: "Gastrointestinal" },
];

// ---------------------------------------------------------------------------
// Allergy Master Data - Common allergens for outpatient/oncology workflows
// ---------------------------------------------------------------------------
const ALLERGY_MASTER = [
  // Medication / Drug allergies
  { code: "ALL_PENICILLIN", substance_name: "Penicillin", substance_type: "Medication", description: "Penicillin-class antibiotics (penicillin G, penicillin V)", severity_level: "High" },
  { code: "ALL_AMOXICILLIN", substance_name: "Amoxicillin", substance_type: "Medication", description: "Aminopenicillin antibiotic", severity_level: "High" },
  { code: "ALL_AMPICILLIN", substance_name: "Ampicillin", substance_type: "Medication", description: "Aminopenicillin antibiotic", severity_level: "High" },
  { code: "ALL_CEFALOSPORINS", substance_name: "Cephalosporins", substance_type: "Medication", description: "Cephalosporin-class antibiotics (cross-reactivity with penicillin possible)", severity_level: "High" },
  { code: "ALL_SULFONAMIDES", substance_name: "Sulfonamides", substance_type: "Medication", description: "Sulfa drugs (sulfamethoxazole, sulfadiazine, etc.)", severity_level: "High" },
  { code: "ALL_ASPIRIN_NSAIDS", substance_name: "Aspirin / NSAIDs", substance_type: "Medication", description: "Aspirin and non-steroidal anti-inflammatory drugs (ibuprofen, naproxen, diclofenac)", severity_level: "Moderate" },
  { code: "ALL_OPIOIDS", substance_name: "Opioids", substance_type: "Medication", description: "Opioid analgesics (morphine, codeine, oxycodone, fentanyl, tramadol)", severity_level: "Moderate" },
  { code: "ALL_CONTRAST_MEDIA", substance_name: "Iodinated Contrast Media", substance_type: "Medication", description: "IV contrast agents for CT/angiography", severity_level: "High" },
  { code: "ALL_GADOLINIUM", substance_name: "Gadolinium-based Contrast", substance_type: "Medication", description: "MRI contrast agents", severity_level: "Moderate" },
  { code: "ALL_PLATINUM", substance_name: "Platinum Compounds", substance_type: "Medication", description: "Cisplatin, carboplatin, oxaliplatin (chemotherapy)", severity_level: "High" },
  { code: "ALL_TAXANES", substance_name: "Taxanes", substance_type: "Medication", description: "Paclitaxel, docetaxel (chemotherapy)", severity_level: "High" },
  { code: "ALL_MONOCLONAL", substance_name: "Monoclonal Antibodies", substance_type: "Medication", description: "Therapeutic monoclonal antibodies (rituximab, trastuzumab, etc.)", severity_level: "Moderate" },
  { code: "ALL_ANESTHETICS_LOCAL", substance_name: "Local Anesthetics", substance_type: "Medication", description: "Lidocaine, bupivacaine, procaine", severity_level: "Moderate" },
  { code: "ALL_ANESTHETICS_GENERAL", substance_name: "General Anesthetics", substance_type: "Medication", description: "Inhalational / IV general anesthetic agents", severity_level: "High" },
  { code: "ALL_INSULIN", substance_name: "Insulin", substance_type: "Medication", description: "Human or analog insulin preparations", severity_level: "Moderate" },

  // Food allergies
  { code: "ALL_PEANUTS", substance_name: "Peanuts", substance_type: "Food", description: "Peanut (groundnut) allergy", severity_level: "High" },
  { code: "ALL_TREE_NUTS", substance_name: "Tree Nuts", substance_type: "Food", description: "Almonds, walnuts, cashews, pistachios, hazelnuts, Brazil nuts, pecans", severity_level: "High" },
  { code: "ALL_SHELLFISH", substance_name: "Shellfish", substance_type: "Food", description: "Crustaceans (shrimp, crab, lobster) and mollusks (clams, mussels, oysters)", severity_level: "High" },
  { code: "ALL_FISH", substance_name: "Fish", substance_type: "Food", description: "Finfish allergy (salmon, tuna, cod, etc.)", severity_level: "High" },
  { code: "ALL_EGGS", substance_name: "Eggs", substance_type: "Food", description: "Hen's egg allergy (white and/or yolk)", severity_level: "Moderate" },
  { code: "ALL_MILK", substance_name: "Cow's Milk", substance_type: "Food", description: "Cow's milk protein allergy", severity_level: "Moderate" },
  { code: "ALL_SOY", substance_name: "Soy", substance_type: "Food", description: "Soybean allergy", severity_level: "Moderate" },
  { code: "ALL_WHEAT", substance_name: "Wheat", substance_type: "Food", description: "Wheat allergy (distinct from celiac disease)", severity_level: "Moderate" },
  { code: "ALL_SESAME", substance_name: "Sesame", substance_type: "Food", description: "Sesame seed allergy", severity_level: "High" },

  // Environmental allergies
  { code: "ALL_LATEX", substance_name: "Latex", substance_type: "Environmental", description: "Natural rubber latex (gloves, catheters, balloons)", severity_level: "High" },
  { code: "ALL_POLLEN", substance_name: "Pollen", substance_type: "Environmental", description: "Tree, grass, or weed pollen (seasonal allergic rhinitis)", severity_level: "Low" },
  { code: "ALL_DUST_MITES", substance_name: "Dust Mites", substance_type: "Environmental", description: "House dust mite allergy", severity_level: "Low" },
  { code: "ALL_MOLD", substance_name: "Mold Spores", substance_type: "Environmental", description: "Indoor/outdoor mold allergy", severity_level: "Low" },
  { code: "ALL_ANIMAL_DANDER", substance_name: "Animal Dander", substance_type: "Environmental", description: "Cat, dog, or other animal dander allergy", severity_level: "Low" },
  { code: "ALL_INSECT_VENOM", substance_name: "Insect Venom", substance_type: "Environmental", description: "Bee, wasp, hornet, fire ant venom allergy", severity_level: "High" },

  // Other
  { code: "ALL_ADHESIVE_TAPE", substance_name: "Adhesive Tape", substance_type: "Other", description: "Medical adhesive tape / dressing allergy", severity_level: "Low" },
  { code: "ALL_CHLORHEXIDINE", substance_name: "Chlorhexidine", substance_type: "Other", description: "Antiseptic agent (skin prep, oral rinse)", severity_level: "High" },
];

// Comorbidities are seeded into comorbidity_master by
// prisma/seedComorbidityMaster.ts (npm run db:seed:comorbidities).

async function seedPerformanceStatusMaster() {
  console.log("🌱 Seeding Performance Status Master (ECOG)...");
  let created = 0;
  let updated = 0;

  for (const ecog of ECOG_SCALE) {
    const result = await prisma.performance_status_master.upsert({
      where: { code: ecog.code },
      update: {
        description: ecog.description,
        display_order: ecog.display_order,
        is_active: true,
        updated_at: new Date(),
        updated_by: "SYSTEM_SEED",
      },
      create: {
        code: ecog.code,
        description: ecog.description,
        display_order: ecog.display_order,
        is_active: true,
        created_by: "SYSTEM_SEED",
        updated_by: "SYSTEM_SEED",
      },
    });

    if (result.id) {
      // Check if it was created or updated by comparing created_at/updated_at
      // Since we can't easily tell, we'll count based on whether the record existed
      // For idempotency reporting, we just note the upsert happened
    }
  }

  const count = await prisma.performance_status_master.count({ where: { code: { in: ECOG_SCALE.map(e => e.code) } } });
  console.log(`✅ Performance Status Master: ${count} records (ECOG 0-5)`);
  return count;
}

async function seedSymptomMaster() {
  console.log("🌱 Seeding Symptom Master...");
  let count = 0;

  for (const symptom of SYMPTOM_MASTER) {
    await prisma.symptom_master.upsert({
      where: { code: symptom.code },
      update: {
        name: symptom.name,
        description: symptom.description,
        category: symptom.category,
        body_system: symptom.body_system,
        is_active: true,
        updated_at: new Date(),
        updated_by: "SYSTEM_SEED",
      },
      create: {
        code: symptom.code,
        name: symptom.name,
        description: symptom.description,
        category: symptom.category,
        body_system: symptom.body_system,
        is_active: true,
        created_by: "SYSTEM_SEED",
        updated_by: "SYSTEM_SEED",
      },
    });
    count++;
  }

  const total = await prisma.symptom_master.count({ where: { code: { in: SYMPTOM_MASTER.map(s => s.code) } } });
  console.log(`✅ Symptom Master: ${total} records seeded/updated`);
  return total;
}

async function seedAllergyMaster() {
  console.log("🌱 Seeding Allergy Master...");
  let count = 0;

  for (const allergy of ALLERGY_MASTER) {
    await prisma.allergy_master.upsert({
      where: { code: allergy.code },
      update: {
        substance_name: allergy.substance_name,
        substance_type: allergy.substance_type,
        description: allergy.description,
        severity_level: allergy.severity_level,
        is_active: true,
        updated_at: new Date(),
        updated_by: "SYSTEM_SEED",
      },
      create: {
        code: allergy.code,
        substance_name: allergy.substance_name,
        substance_type: allergy.substance_type,
        description: allergy.description,
        severity_level: allergy.severity_level,
        is_active: true,
        created_by: "SYSTEM_SEED",
        updated_by: "SYSTEM_SEED",
      },
    });
    count++;
  }

  const total = await prisma.allergy_master.count({ where: { code: { in: ALLERGY_MASTER.map(a => a.code) } } });
  console.log(`✅ Allergy Master: ${total} records seeded/updated`);
  return total;
}

async function main() {
  console.log("🚀 Starting Clinical Master Details Seeding...\n");

  try {
    const perfStatusCount = await seedPerformanceStatusMaster();
    console.log("");
    const symptomCount = await seedSymptomMaster();
    console.log("");
    const allergyCount = await seedAllergyMaster();
    console.log("");

    console.log("📊 Seeding Summary:");
    console.log(`  - Performance Status Master (ECOG): ${perfStatusCount} records`);
    console.log(`  - Symptom Master: ${symptomCount} records`);
    console.log(`  - Allergy Master: ${allergyCount} records`);
    console.log("");
    console.log("🎉 Clinical Master Details seeding completed successfully!");

  } catch (error) {
    console.error("❌ Seeding failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();