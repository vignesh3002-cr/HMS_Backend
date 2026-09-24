import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// ---------------------------------------------------------------------------
// Comorbidity Master (comorbidity_master)
//
// Co-existing conditions offered in the Consultation step's Comorbidities
// picker. Curated from the internationally used comorbidity indices -
// Charlson Comorbidity Index, Elixhauser comorbidities and the WHO major
// noncommunicable-disease groups - plus common chronic conditions seen in
// general and oncology practice. Codes are WHO ICD-10. Anything missing is
// added by doctors from the consultation ("+ Add"), stored as is_custom.
//
// Entry: [code suffix, name, ICD-10 code, is_chronic (default true)]
// Stored code = "CMB_" + suffix (the upsert key - never rename a suffix).
// ---------------------------------------------------------------------------
type Entry = [string, string, string | null, boolean?];

const COMORBIDITIES: Record<string, Entry[]> = {
  "Cardiovascular": [
    ["HTN", "Essential (primary) hypertension", "I10"],
    ["HTN_HEART", "Hypertensive heart disease", "I11.9"],
    ["HTN_CKD", "Hypertensive chronic kidney disease", "I12.9"],
    ["HTN_SECONDARY", "Secondary hypertension", "I15.9"],
    ["CAD", "Coronary artery disease (atherosclerotic heart disease)", "I25.1"],
    ["ANGINA", "Angina pectoris (stable)", "I20.9"],
    ["OLD_MI", "Old myocardial infarction (history of heart attack)", "I25.2"],
    ["HF", "Heart failure", "I50.9"],
    ["CHF", "Congestive heart failure", "I50.0"],
    ["AF", "Atrial fibrillation / atrial flutter", "I48"],
    ["ARRHYTHMIA", "Cardiac arrhythmia (other)", "I49.9"],
    ["SSS", "Sick sinus syndrome", "I49.5"],
    ["AV_BLOCK", "Atrioventricular (heart) block", "I44.3"],
    ["PACEMAKER", "Presence of cardiac pacemaker", "Z95.0"],
    ["CARDIAC_IMPLANT", "Presence of implantable cardioverter-defibrillator (ICD)", "Z95.8"],
    ["CABG", "Presence of coronary artery bypass graft (post-CABG)", "Z95.1"],
    ["CORONARY_STENT", "Presence of coronary stent (post-PCI)", "Z95.5"],
    ["PROSTHETIC_VALVE", "Presence of prosthetic heart valve", "Z95.2"],
    ["RHD", "Rheumatic heart disease", "I09.9"],
    ["AORTIC_STENOSIS", "Aortic valve stenosis", "I35.0"],
    ["MITRAL_REGURG", "Mitral valve regurgitation", "I34.0"],
    ["CARDIOMYOPATHY", "Cardiomyopathy", "I42.9"],
    ["PAH_PRIMARY", "Primary pulmonary arterial hypertension", "I27.0"],
    ["PH_SECONDARY", "Pulmonary hypertension (secondary)", "I27.2"],
    ["CONGENITAL_HD", "Congenital heart disease", "Q24.9"],
    ["PVD", "Peripheral vascular disease", "I73.9"],
    ["AORTIC_ANEURYSM", "Aortic aneurysm", "I71.9"],
    ["CAROTID_STENOSIS", "Carotid artery stenosis", "I65.2"],
    ["VTE_HISTORY", "Personal history of venous thromboembolism (DVT / PE)", "Z86.7"],
    ["VARICOSE_VEINS", "Varicose veins of lower limbs", "I83.9"],
    ["CVI", "Chronic venous insufficiency", "I87.2"],
    ["ANTICOAGULANT", "Long-term anticoagulant therapy", "Z92.1"],
  ],

  "Cerebrovascular": [
    ["STROKE_SEQUELAE", "History of stroke (sequelae of stroke)", "I69.4"],
    ["ISCHEMIC_STROKE_HX", "History of ischaemic stroke (cerebral infarction)", "I69.3"],
    ["HEMORRHAGIC_STROKE_HX", "History of intracerebral haemorrhage", "I69.1"],
    ["TIA", "Transient ischaemic attack (TIA)", "G45.9"],
    ["HEMIPLEGIA", "Hemiplegia / hemiparesis", "G81.9"],
    ["CEREBRAL_ANEURYSM", "Cerebral aneurysm (unruptured)", "I67.1"],
  ],

  "Endocrine & Metabolic": [
    ["DM1", "Type 1 diabetes mellitus", "E10.9"],
    ["DM2", "Type 2 diabetes mellitus", "E11.9"],
    ["DM_COMPLICATED", "Diabetes mellitus with end-organ damage (complicated)", "E11.7"],
    ["DM_NEPHROPATHY", "Diabetic nephropathy", "E11.2"],
    ["DM_RETINOPATHY", "Diabetic retinopathy", "E11.3"],
    ["DM_NEUROPATHY", "Diabetic neuropathy", "E11.4"],
    ["DM_FOOT", "Diabetic foot (with peripheral angiopathy)", "E11.5"],
    ["PREDIABETES", "Prediabetes / impaired glucose tolerance", "R73.0"],
    ["HYPOTHYROIDISM", "Hypothyroidism", "E03.9"],
    ["HYPERTHYROIDISM", "Hyperthyroidism (thyrotoxicosis)", "E05.9"],
    ["HASHIMOTO", "Hashimoto's thyroiditis", "E06.3"],
    ["GOITRE", "Nontoxic goitre", "E04.9"],
    ["HYPOPARATHYROIDISM", "Hypoparathyroidism", "E20.9"],
    ["HYPERPARATHYROIDISM", "Hyperparathyroidism", "E21.3"],
    ["ADRENAL_INSUFFICIENCY", "Adrenal insufficiency (Addison's disease)", "E27.1"],
    ["CUSHING", "Cushing's syndrome", "E24.9"],
    ["HYPERALDOSTERONISM", "Primary hyperaldosteronism", "E26.0"],
    ["HYPOPITUITARISM", "Hypopituitarism", "E23.0"],
    ["ACROMEGALY", "Acromegaly", "E22.0"],
    ["DIABETES_INSIPIDUS", "Diabetes insipidus", "E23.2"],
    ["OVERWEIGHT", "Overweight", "E66.3"],
    ["OBESITY", "Obesity", "E66.9"],
    ["MORBID_OBESITY", "Morbid (severe) obesity", "E66.8"],
    ["OBESITY_HYPOVENTILATION", "Obesity hypoventilation syndrome", "E66.2"],
    ["METABOLIC_SYNDROME", "Metabolic syndrome", "E88.8"],
    ["DYSLIPIDEMIA", "Dyslipidaemia / hyperlipidaemia", "E78.5"],
    ["HYPERCHOLESTEROLEMIA", "Pure hypercholesterolaemia", "E78.0"],
    ["HYPERTRIGLYCERIDEMIA", "Hypertriglyceridaemia", "E78.1"],
    ["HYPERURICEMIA", "Hyperuricaemia", "E79.0"],
    ["VITAMIN_D_DEFICIENCY", "Vitamin D deficiency", "E55.9"],
    ["VITAMIN_B12_DEFICIENCY", "Vitamin B12 deficiency", "E53.8"],
    ["ELECTROLYTE_DISORDER", "Chronic fluid and electrolyte disorder", "E87.8"],
    ["HEMOCHROMATOSIS", "Haemochromatosis", "E83.1"],
    ["WILSON", "Wilson's disease", "E83.0"],
    ["AMYLOIDOSIS", "Amyloidosis", "E85.9"],
    ["PORPHYRIA", "Porphyria", "E80.2"],
  ],

  "Respiratory": [
    ["COPD", "Chronic obstructive pulmonary disease (COPD)", "J44.9"],
    ["EMPHYSEMA", "Emphysema", "J43.9"],
    ["CHRONIC_BRONCHITIS", "Chronic bronchitis", "J42"],
    ["ASTHMA", "Asthma", "J45.9"],
    ["BRONCHIECTASIS", "Bronchiectasis", "J47"],
    ["ILD", "Interstitial lung disease", "J84.9"],
    ["IPF", "Idiopathic pulmonary fibrosis", "J84.1"],
    ["SARCOIDOSIS", "Sarcoidosis", "D86.9"],
    ["OSA", "Obstructive sleep apnoea", "G47.3"],
    ["CYSTIC_FIBROSIS", "Cystic fibrosis", "E84.9"],
    ["PNEUMOCONIOSIS", "Pneumoconiosis (occupational lung disease)", "J64"],
    ["CHRONIC_RESP_FAILURE", "Chronic respiratory failure", "J96.1"],
    ["HOME_OXYGEN", "Long-term home oxygen dependence", "Z99.8"],
    ["LUNG_TRANSPLANT", "Lung transplant recipient", "Z94.2"],
    ["TRACHEOSTOMY", "Tracheostomy status", "Z93.0"],
  ],

  "Renal & Urological": [
    ["CKD", "Chronic kidney disease (stage unspecified)", "N18.9"],
    ["CKD1", "Chronic kidney disease, stage 1", "N18.1"],
    ["CKD2", "Chronic kidney disease, stage 2", "N18.2"],
    ["CKD3", "Chronic kidney disease, stage 3", "N18.3"],
    ["CKD4", "Chronic kidney disease, stage 4", "N18.4"],
    ["CKD5", "Chronic kidney disease, stage 5", "N18.5"],
    ["DIALYSIS", "End-stage kidney disease on dialysis", "Z99.2"],
    ["KIDNEY_TRANSPLANT", "Kidney transplant recipient", "Z94.0"],
    ["NEPHROTIC", "Nephrotic syndrome", "N04.9"],
    ["CHRONIC_GN", "Chronic glomerulonephritis", "N03.9"],
    ["PKD", "Polycystic kidney disease", "Q61.3"],
    ["NEPHROLITHIASIS", "Kidney stones (nephrolithiasis)", "N20.0"],
    ["BPH", "Benign prostatic hyperplasia", "N40"],
    ["RECURRENT_UTI", "Recurrent urinary tract infection", "N39.0"],
    ["NEUROGENIC_BLADDER", "Neurogenic bladder", "N31.9"],
    ["URINARY_INCONTINENCE", "Urinary incontinence", "R32"],
    ["SINGLE_KIDNEY", "Acquired absence of kidney (single kidney)", "Z90.5"],
    ["RENAL_ARTERY_STENOSIS", "Renal artery stenosis", "I70.1"],
  ],

  "Hepatic & Gastrointestinal": [
    ["CLD", "Chronic liver disease", "K76.9"],
    ["CIRRHOSIS", "Liver cirrhosis", "K74.6"],
    ["ALCOHOLIC_LIVER", "Alcoholic liver disease", "K70.9"],
    ["NAFLD", "Non-alcoholic fatty liver disease (MASLD)", "K76.0"],
    ["PORTAL_HTN", "Portal hypertension", "K76.6"],
    ["ESOPHAGEAL_VARICES", "Oesophageal varices", "I85.9"],
    ["AUTOIMMUNE_HEPATITIS", "Autoimmune hepatitis", "K75.4"],
    ["PBC", "Primary biliary cholangitis", "K74.3"],
    ["PSC", "Primary sclerosing cholangitis", "K83.0"],
    ["LIVER_TRANSPLANT", "Liver transplant recipient", "Z94.4"],
    ["GERD", "Gastro-oesophageal reflux disease (GERD)", "K21.9"],
    ["BARRETT", "Barrett's oesophagus", "K22.7"],
    ["PUD", "Peptic ulcer disease", "K27.9"],
    ["CHRONIC_GASTRITIS", "Chronic gastritis", "K29.5"],
    ["CROHN", "Crohn's disease", "K50.9"],
    ["UC", "Ulcerative colitis", "K51.9"],
    ["IBD", "Inflammatory bowel disease (unspecified)", "K52.9"],
    ["IBS", "Irritable bowel syndrome", "K58.9"],
    ["CELIAC", "Coeliac disease", "K90.0"],
    ["CHRONIC_PANCREATITIS", "Chronic pancreatitis", "K86.1"],
    ["DIVERTICULAR", "Diverticular disease of intestine", "K57.9"],
    ["CHOLELITHIASIS", "Gallstones (cholelithiasis)", "K80.2"],
    ["HIATUS_HERNIA", "Hiatus hernia", "K44.9"],
    ["CHRONIC_CONSTIPATION", "Chronic constipation", "K59.0"],
    ["COLOSTOMY", "Colostomy status", "Z93.3"],
    ["ILEOSTOMY", "Ileostomy status", "Z93.2"],
    ["BARIATRIC", "Bariatric surgery (intestinal bypass) status", "Z98.0"],
  ],

  "Neurological": [
    ["EPILEPSY", "Epilepsy / seizure disorder", "G40.9"],
    ["PARKINSON", "Parkinson's disease", "G20"],
    ["ALZHEIMER", "Alzheimer's disease", "G30.9"],
    ["DEMENTIA", "Dementia", "F03"],
    ["VASCULAR_DEMENTIA", "Vascular dementia", "F01.9"],
    ["MS", "Multiple sclerosis", "G35"],
    ["MIGRAINE", "Migraine", "G43.9"],
    ["PERIPHERAL_NEUROPATHY", "Peripheral neuropathy", "G62.9"],
    ["MYASTHENIA", "Myasthenia gravis", "G70.0"],
    ["MND", "Motor neurone disease (ALS)", "G12.2"],
    ["CEREBRAL_PALSY", "Cerebral palsy", "G80.9"],
    ["SPINAL_CORD_INJURY", "Sequelae of spinal cord injury", "T91.3"],
    ["PARAPLEGIA", "Paraplegia", "G82.2"],
    ["TETRAPLEGIA", "Tetraplegia (quadriplegia)", "G82.5"],
    ["TBI_SEQUELAE", "Sequelae of traumatic brain injury", "T90.5"],
    ["HUNTINGTON", "Huntington's disease", "G10"],
    ["ESSENTIAL_TREMOR", "Essential tremor", "G25.0"],
    ["RESTLESS_LEGS", "Restless legs syndrome", "G25.8"],
    ["NARCOLEPSY", "Narcolepsy", "G47.4"],
    ["INSOMNIA", "Chronic insomnia", "G47.0"],
    ["HYDROCEPHALUS", "Hydrocephalus", "G91.9"],
    ["TRIGEMINAL_NEURALGIA", "Trigeminal neuralgia", "G50.0"],
    ["MUSCULAR_DYSTROPHY", "Muscular dystrophy", "G71.0"],
  ],

  "Mental & Behavioural": [
    ["DEPRESSION", "Major depressive disorder", "F32.9"],
    ["RECURRENT_DEPRESSION", "Recurrent depressive disorder", "F33.9"],
    ["GAD", "Generalised anxiety disorder", "F41.1"],
    ["PANIC", "Panic disorder", "F41.0"],
    ["BIPOLAR", "Bipolar affective disorder", "F31.9"],
    ["SCHIZOPHRENIA", "Schizophrenia", "F20.9"],
    ["PSYCHOSIS", "Psychotic disorder (other)", "F29"],
    ["PTSD", "Post-traumatic stress disorder (PTSD)", "F43.1"],
    ["OCD", "Obsessive-compulsive disorder", "F42.9"],
    ["ADHD", "Attention-deficit hyperactivity disorder (ADHD)", "F90.0"],
    ["AUTISM", "Autism spectrum disorder", "F84.0"],
    ["INTELLECTUAL_DISABILITY", "Intellectual disability", "F79"],
    ["EATING_DISORDER", "Eating disorder (anorexia / bulimia)", "F50.9"],
    ["PERSONALITY_DISORDER", "Personality disorder", "F60.9"],
    ["ALCOHOL_DEPENDENCE", "Alcohol use disorder / dependence", "F10.2"],
    ["OPIOID_DEPENDENCE", "Opioid use disorder", "F11.2"],
    ["CANNABIS_DEPENDENCE", "Cannabis use disorder", "F12.2"],
    ["SUBSTANCE_DEPENDENCE", "Other psychoactive substance use disorder", "F19.2"],
  ],

  "Hematological": [
    ["IDA", "Iron-deficiency anaemia", "D50.9"],
    ["ANEMIA_CHRONIC_DISEASE", "Anaemia of chronic disease", "D63.8"],
    ["B12_ANEMIA", "Vitamin B12 deficiency anaemia", "D51.9"],
    ["FOLATE_ANEMIA", "Folate deficiency anaemia", "D52.9"],
    ["SICKLE_CELL", "Sickle-cell disease", "D57.1"],
    ["SICKLE_TRAIT", "Sickle-cell trait", "D57.3"],
    ["THALASSEMIA", "Thalassaemia", "D56.9"],
    ["THALASSEMIA_TRAIT", "Thalassaemia trait (minor)", "D56.3"],
    ["G6PD", "G6PD deficiency", "D55.0"],
    ["APLASTIC_ANEMIA", "Aplastic anaemia", "D61.9"],
    ["HEMOPHILIA_A", "Haemophilia A", "D66"],
    ["HEMOPHILIA_B", "Haemophilia B", "D67"],
    ["VWD", "Von Willebrand disease", "D68.0"],
    ["COAGULOPATHY", "Coagulation disorder (other)", "D68.9"],
    ["THROMBOPHILIA", "Thrombophilia (e.g. Factor V Leiden)", "D68.5"],
    ["APS", "Antiphospholipid syndrome", "D68.6"],
    ["ITP", "Immune thrombocytopenia (ITP)", "D69.3"],
    ["THROMBOCYTOPENIA", "Thrombocytopenia (chronic)", "D69.6"],
    ["POLYCYTHEMIA_VERA", "Polycythaemia vera", "D45"],
    ["ESSENTIAL_THROMBOCYTHEMIA", "Essential thrombocythaemia", "D47.3"],
    ["MDS", "Myelodysplastic syndrome", "D46.9"],
    ["MGUS", "Monoclonal gammopathy of undetermined significance (MGUS)", "D47.2"],
    ["ASPLENIA", "Asplenia / hyposplenism (incl. post-splenectomy)", "D73.0"],
    ["NEUTROPENIA", "Chronic neutropenia", "D70"],
  ],

  "Infectious (chronic)": [
    ["HIV", "HIV disease", "B24"],
    ["HIV_ASYMPTOMATIC", "Asymptomatic HIV infection status", "Z21"],
    ["HBV", "Chronic hepatitis B", "B18.1"],
    ["HBV_HDV", "Chronic hepatitis B with delta agent (HDV)", "B18.0"],
    ["HCV", "Chronic hepatitis C", "B18.2"],
    ["TB_ACTIVE", "Tuberculosis (active, respiratory)", "A16.9"],
    ["TB_HISTORY", "History of tuberculosis (sequelae)", "B90.9"],
    ["LATENT_TB", "Latent tuberculosis infection (positive TST / IGRA)", "R76.1"],
    ["LEPROSY", "Leprosy (Hansen's disease)", "A30.9"],
    ["CHAGAS", "Chagas disease (chronic, with heart involvement)", "B57.2"],
    ["SCHISTOSOMIASIS", "Schistosomiasis", "B65.9"],
    ["LATENT_SYPHILIS", "Latent syphilis", "A53.0"],
    ["MRSA_CARRIER", "MRSA carrier", "Z22.3"],
    ["POST_COVID", "Post COVID-19 condition (long COVID)", "U09.9"],
  ],

  "Immunological & Rheumatological": [
    ["RA", "Rheumatoid arthritis", "M06.9"],
    ["SLE", "Systemic lupus erythematosus (SLE)", "M32.9"],
    ["SJOGREN", "Sjogren syndrome", "M35.0"],
    ["SYSTEMIC_SCLEROSIS", "Systemic sclerosis (scleroderma)", "M34.9"],
    ["MCTD", "Mixed connective tissue disease", "M35.1"],
    ["MYOSITIS", "Polymyositis / dermatomyositis", "M33.9"],
    ["ANKYLOSING_SPONDYLITIS", "Ankylosing spondylitis", "M45"],
    ["PSORIATIC_ARTHRITIS", "Psoriatic arthritis", "L40.5"],
    ["VASCULITIS", "Systemic vasculitis", "M31.9"],
    ["GCA", "Giant cell arteritis", "M31.6"],
    ["PMR", "Polymyalgia rheumatica", "M35.3"],
    ["BEHCET", "Behcet's disease", "M35.2"],
    ["GPA", "Granulomatosis with polyangiitis", "M31.3"],
    ["JIA", "Juvenile idiopathic arthritis", "M08.9"],
    ["FMF", "Familial Mediterranean fever", "M04.1"],
    ["PRIMARY_IMMUNODEFICIENCY", "Primary immunodeficiency", "D84.9"],
    ["CVID", "Common variable immunodeficiency", "D83.9"],
    ["SECONDARY_IMMUNODEFICIENCY", "Secondary immunodeficiency", "D84.8"],
    ["HEREDITARY_ANGIOEDEMA", "Hereditary angioedema", "D84.1"],
    ["IMMUNOSUPPRESSIVE_THERAPY", "Long-term immunosuppressive / corticosteroid therapy", "Z92.2"],
    ["HEART_TRANSPLANT", "Heart transplant recipient", "Z94.1"],
    ["BMT", "Bone marrow / stem cell transplant recipient", "Z94.8"],
    ["ORGAN_TRANSPLANT", "Organ transplant recipient (other)", "Z94.9"],
  ],

  "Musculoskeletal": [
    ["OA", "Osteoarthritis", "M19.9"],
    ["KNEE_OA", "Osteoarthritis of knee", "M17.9"],
    ["HIP_OA", "Osteoarthritis of hip", "M16.9"],
    ["OSTEOPOROSIS", "Osteoporosis", "M81.9"],
    ["OSTEOPOROTIC_FRACTURE", "Osteoporosis with pathological fracture", "M80.9"],
    ["OSTEOPENIA", "Osteopenia", "M85.8"],
    ["GOUT", "Gout", "M10.9"],
    ["CHRONIC_LOW_BACK_PAIN", "Chronic low back pain", "M54.5"],
    ["DISC_DISORDER", "Intervertebral disc disorder", "M51.9"],
    ["SPONDYLOSIS", "Spondylosis (cervical / lumbar)", "M47.9"],
    ["SPINAL_STENOSIS", "Spinal stenosis", "M48.0"],
    ["SCOLIOSIS", "Scoliosis", "M41.9"],
    ["FIBROMYALGIA", "Fibromyalgia", "M79.7"],
    ["CHRONIC_OSTEOMYELITIS", "Chronic osteomyelitis", "M86.6"],
    ["PAGET", "Paget's disease of bone", "M88.9"],
    ["AVN", "Avascular necrosis of bone", "M87.9"],
    ["JOINT_REPLACEMENT", "Presence of orthopaedic joint implant (joint replacement)", "Z96.6"],
    ["AMPUTATION", "Acquired absence of limb (amputation)", "Z89.9"],
  ],

  "Oncology history": [
    ["MALIGNANCY_HISTORY", "Personal history of malignant neoplasm", "Z85.9"],
    ["BREAST_CANCER_HISTORY", "Personal history of breast cancer", "Z85.3"],
    ["GI_CANCER_HISTORY", "Personal history of digestive-organ cancer (e.g. colorectal)", "Z85.0"],
    ["LUNG_CANCER_HISTORY", "Personal history of lung cancer", "Z85.1"],
    ["GENITAL_CANCER_HISTORY", "Personal history of genital-organ cancer (e.g. prostate, cervix)", "Z85.4"],
    ["LEUKEMIA_HISTORY", "Personal history of leukaemia", "Z85.6"],
    ["LYMPHOMA_HISTORY", "Personal history of lymphoma", "Z85.7"],
    ["METASTATIC_SOLID_TUMOUR", "Metastatic solid tumour (secondary malignancy)", "C79.9"],
    ["CHEMOTHERAPY_HISTORY", "Personal history of chemotherapy", "Z92.6"],
    ["RADIOTHERAPY_HISTORY", "Personal history of radiotherapy", "Z92.3"],
    ["HEREDITARY_CANCER", "Genetic susceptibility to cancer (e.g. BRCA carrier)", "Z15.0"],
  ],

  "Eye & ENT": [
    ["GLAUCOMA", "Glaucoma", "H40.9"],
    ["CATARACT", "Cataract", "H26.9"],
    ["AMD", "Age-related macular degeneration", "H35.3"],
    ["VISUAL_IMPAIRMENT", "Visual impairment / blindness", "H54.9"],
    ["CHRONIC_UVEITIS", "Chronic uveitis", "H20.1"],
    ["DRY_EYE", "Dry eye syndrome", "H04.1"],
    ["HEARING_LOSS", "Hearing loss", "H91.9"],
    ["TINNITUS", "Tinnitus", "H93.1"],
    ["MENIERE", "Meniere's disease", "H81.0"],
    ["CHRONIC_OTITIS_MEDIA", "Chronic suppurative otitis media", "H66.3"],
    ["CHRONIC_SINUSITIS", "Chronic sinusitis", "J32.9"],
    ["ALLERGIC_RHINITIS", "Allergic rhinitis", "J30.4"],
  ],

  "Skin": [
    ["PSORIASIS", "Psoriasis", "L40.9"],
    ["ATOPIC_DERMATITIS", "Atopic dermatitis (eczema)", "L20.9"],
    ["CHRONIC_URTICARIA", "Chronic urticaria", "L50.8"],
    ["VITILIGO", "Vitiligo", "L80"],
    ["HIDRADENITIS", "Hidradenitis suppurativa", "L73.2"],
    ["PEMPHIGUS", "Pemphigus", "L10.9"],
    ["BULLOUS_PEMPHIGOID", "Bullous pemphigoid", "L12.0"],
    ["DISCOID_LUPUS", "Discoid lupus erythematosus", "L93.0"],
    ["PRESSURE_ULCER", "Pressure ulcer (bedsore)", "L89.9"],
    ["CHRONIC_LEG_ULCER", "Chronic leg ulcer", "L97"],
  ],

  "Reproductive & Obstetric": [
    ["PREGNANCY", "Pregnancy (current)", "Z33", false],
    ["POSTPARTUM", "Postpartum period", "Z39.2", false],
    ["GDM", "Gestational diabetes mellitus", "O24.4", false],
    ["PREECLAMPSIA_HISTORY", "History of pre-eclampsia / pregnancy complication", "Z87.5", false],
    ["PCOS", "Polycystic ovary syndrome (PCOS)", "E28.2"],
    ["ENDOMETRIOSIS", "Endometriosis", "N80.9"],
    ["FIBROIDS", "Uterine fibroids (leiomyoma)", "D25.9"],
    ["MENOPAUSE", "Menopausal / post-menopausal state", "N95.1", false],
    ["FEMALE_INFERTILITY", "Female infertility", "N97.9"],
    ["ERECTILE_DYSFUNCTION", "Erectile dysfunction", "N48.4"],
    ["MALE_HYPOGONADISM", "Male hypogonadism", "E29.1"],
  ],

  "Lifestyle & Other": [
    ["TOBACCO_SMOKER", "Tobacco use (current smoker)", "F17.2"],
    ["SMOKELESS_TOBACCO", "Smokeless tobacco use (chewing tobacco / gutka)", "F17.2"],
    ["FORMER_SMOKER", "Former smoker / history of substance use", "Z86.4"],
    ["ALCOHOL_HARMFUL_USE", "Harmful alcohol use", "F10.1"],
    ["SEDENTARY", "Physical inactivity (sedentary lifestyle)", "Z72.3"],
    ["UNDERWEIGHT", "Underweight / low BMI", "R63.6"],
    ["MALNUTRITION", "Protein-energy malnutrition", "E46"],
    ["CACHEXIA", "Cachexia", "R64"],
    ["FRAILTY", "Frailty (age-related debility)", "R54"],
    ["CHRONIC_PAIN", "Chronic pain syndrome", "R52.2"],
    ["WHEELCHAIR", "Wheelchair dependence", "Z99.3"],
    ["REDUCED_MOBILITY", "Reduced mobility / bedridden", "Z74.0"],
    ["OCCUPATIONAL_EXPOSURE", "Occupational exposure to risk factors", "Z57.9"],
    ["MAJOR_SURGERY_HISTORY", "Personal history of major surgery", "Z92.4", false],
  ],
};

async function seedComorbidityMaster() {
  console.log("🌱 Seeding Comorbidity Master...");

  const rows = Object.entries(COMORBIDITIES).flatMap(([category, entries]) =>
    entries.map(([suffix, name, icd, chronic]) => ({
      code: `CMB_${suffix}`,
      comorbidity_name: name,
      category,
      icd_code: icd,
      is_chronic: chronic ?? true,
    }))
  );

  // Codes are the upsert key and names are matched case-insensitively by
  // the "+ Add" flow, so both must be unique.
  const seenCodes = new Set<string>();
  const seenNames = new Set<string>();
  for (const row of rows) {
    const nameKey = row.comorbidity_name.toLowerCase();
    if (seenCodes.has(row.code)) throw new Error(`Duplicate code ${row.code}`);
    if (seenNames.has(nameKey)) throw new Error(`Duplicate name ${row.comorbidity_name}`);
    seenCodes.add(row.code);
    seenNames.add(nameKey);
  }

  // Small parallel batches keep the remote round trips reasonable.
  // is_active is not touched on update, so an entry switched off by an
  // admin stays off when the seed is re-run.
  const BATCH = 8;
  for (let i = 0; i < rows.length; i += BATCH) {
    await Promise.all(
      rows.slice(i, i + BATCH).map((row) =>
        prisma.comorbidity_master.upsert({
          where: { code: row.code },
          update: {
            comorbidity_name: row.comorbidity_name,
            category: row.category,
            icd_code: row.icd_code,
            is_chronic: row.is_chronic,
            updated_by: "SYSTEM_SEED",
            updated_at: new Date(),
          },
          create: {
            ...row,
            is_custom: false,
            is_active: true,
            created_by: "SYSTEM_SEED",
            updated_by: "SYSTEM_SEED",
          },
        })
      )
    );
  }

  const total = await prisma.comorbidity_master.count({
    where: { code: { in: rows.map((row) => row.code) } },
  });
  console.log(`✅ Comorbidity Master: ${total} records seeded/updated across ${Object.keys(COMORBIDITIES).length} categories`);
  return total;
}

async function main() {
  try {
    await seedComorbidityMaster();
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
