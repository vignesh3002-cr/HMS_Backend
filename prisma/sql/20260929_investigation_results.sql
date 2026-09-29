-- Diagnosis tab: Investigation Results - the tumour markers / monitoring
-- tests tracked per cancer type (source: client sheet "Cancer specify
-- charts.xlsx", one tab per cancer type with a Date column and the tests
-- with their normal ranges), entered on each visit.
--   investigation_parameter        master: the tests of each cancer type
--   patient_investigation_result   one value per visit per test
-- Also adds the Germ Cell Tumour and Gestational Trophoblastic Neoplasia
-- cancer types the NSGCT / BHCG charts belong to.

BEGIN;

-- ------------------------------------------------ new cancer types
INSERT INTO public.cancer_types (cancer_type_id, cancer_type, icd10, icd_o3_topography, staging_system, active_status)
SELECT v.cancer_type_id, v.cancer_type, v.icd10, v.topography, v.staging_system, 1
  FROM (VALUES
    ('CT023', 'Germ Cell Tumour', 'C62', 'C62.9', 'AJCC TNM 8th + IGCCCG (S-stage: AFP/hCG/LDH)'),
    ('CT024', 'Gestational Trophoblastic Neoplasia', 'C58', 'C58.9', 'FIGO + WHO Prognostic Score')
  ) AS v (cancer_type_id, cancer_type, icd10, topography, staging_system)
 WHERE NOT EXISTS (
    SELECT 1 FROM public.cancer_types t
     WHERE t.cancer_type_id = v.cancer_type_id OR t.cancer_type = v.cancer_type
 );

INSERT INTO public.cancer_subtypes (subtype_id, cancer_type_id, subtype_name, icd_o3_morphology, icd10_subtype, active_status)
SELECT v.subtype_id, v.cancer_type_id, v.subtype_name, v.morphology, v.icd10, 1
  FROM (VALUES
    ('CST130', 'CT023', 'NSGCT (Non-seminomatous)', '9065/3', 'C62.9'),
    ('CST131', 'CT023', 'Seminoma', '9061/3', 'C62.9'),
    ('CST132', 'CT024', 'Choriocarcinoma', '9100/3', 'C58'),
    ('CST133', 'CT024', 'Invasive Mole', '9100/1', 'C58'),
    ('CST134', 'CT024', 'PSTT / ETT', '9104/1', 'C58')
  ) AS v (subtype_id, cancer_type_id, subtype_name, morphology, icd10)
 WHERE NOT EXISTS (SELECT 1 FROM public.cancer_subtypes s WHERE s.subtype_id = v.subtype_id);

UPDATE public.id_sequences SET current_number = GREATEST(current_number, 24) WHERE entity_name = 'CANCER_TYPE';
UPDATE public.id_sequences SET current_number = GREATEST(current_number, 134) WHERE entity_name = 'CANCER_SUBTYPE';

-- ------------------------------------------ investigation_parameter
CREATE TABLE IF NOT EXISTS public.investigation_parameter (
    id               BIGSERIAL PRIMARY KEY,
    parameter_id     VARCHAR(100) NOT NULL,
    cancer_type_id   VARCHAR(100) NOT NULL,
    -- The sheet tab the test comes from (e.g. "CML (BCR-ABL)").
    chart_name       VARCHAR(150) NOT NULL,
    -- Optional "|"-separated histopathology keywords (as cancer_score):
    -- when set, the test is only offered once a matching subtype is picked.
    subtype_keywords VARCHAR(255),
    parameter_code   VARCHAR(50) NOT NULL,
    parameter_name   VARCHAR(150) NOT NULL,
    input_type       VARCHAR(20) NOT NULL DEFAULT 'NUMBER',
    unit             VARCHAR(50),
    normal_min       NUMERIC(14, 4),
    normal_max       NUMERIC(14, 4),
    -- The range as the sheet writes it (e.g. "<5.0", "Up to 35").
    range_label      VARCHAR(100),
    -- "|"-separated choices for SELECT tests (e.g. "+|-").
    select_options   VARCHAR(255),
    display_order    INT DEFAULT 1,
    active_status    SMALLINT DEFAULT 1,
    created_at       TIMESTAMP(6) DEFAULT now(),
    updated_at       TIMESTAMP(6) DEFAULT now(),
    CONSTRAINT uq_investigation_parameter_id UNIQUE (parameter_id),
    CONSTRAINT uq_investigation_parameter_code UNIQUE (cancer_type_id, chart_name, parameter_code),
    CONSTRAINT chk_investigation_parameter_type CHECK (input_type IN ('NUMBER', 'TEXT', 'DATE', 'SELECT')),
    CONSTRAINT fk_investigation_parameter_cancer_type FOREIGN KEY (cancer_type_id)
        REFERENCES public.cancer_types (cancer_type_id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_investigation_parameter_type ON public.investigation_parameter (cancer_type_id);

ALTER TABLE public.investigation_parameter ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.investigation_parameter FROM anon, authenticated, service_role;

INSERT INTO public.investigation_parameter
    (parameter_id, cancer_type_id, chart_name, subtype_keywords, parameter_code, parameter_name,
     input_type, unit, normal_min, normal_max, range_label, select_options, display_order)
SELECT v.* FROM (VALUES
    -- Ca Prostate
    ('IVP0001', 'CT006', 'Ca Prostate', NULL, 'PSA', 'PSA Level', 'NUMBER', NULL, NULL::numeric, 5.0::numeric, '<5.0', NULL, 1),
    -- NSGCT (BHCG, LDH, AFP)
    ('IVP0002', 'CT023', 'NSGCT', 'NSGCT|Non-seminomatous', 'BHCG', 'BHCG', 'NUMBER', NULL, 0, 5.3, '0 - 5.3', NULL, 1),
    ('IVP0003', 'CT023', 'NSGCT', 'NSGCT|Non-seminomatous', 'LDH', 'LDH', 'NUMBER', NULL, 0, 248, '0 - 248', NULL, 2),
    ('IVP0004', 'CT023', 'NSGCT', 'NSGCT|Non-seminomatous', 'AFP', 'AFP', 'NUMBER', NULL, 0, 5.5, '0 - 5.5', NULL, 3),
    -- BHCG
    ('IVP0005', 'CT023', 'BHCG', 'Seminoma', 'BHCG', 'BHCG', 'NUMBER', NULL, 0, 5.3, '0 - 5.3', NULL, 1),
    ('IVP0006', 'CT024', 'BHCG', NULL, 'BHCG', 'BHCG', 'NUMBER', NULL, 0, 5.3, '0 - 5.3', NULL, 1),
    -- Ca Ovary (+ the germ cell markers for ovarian germ cell tumours)
    ('IVP0007', 'CT010', 'Ca Ovary', NULL, 'CA125', 'CA-125', 'NUMBER', NULL, NULL, 35, 'Up to 35', NULL, 1),
    ('IVP0008', 'CT010', 'Ca Ovary', NULL, 'CA199', 'CA 19-9', 'NUMBER', NULL, 0, 37, '0 - 37', NULL, 2),
    ('IVP0009', 'CT010', 'Ca Ovary', NULL, 'CEA', 'CEA', 'NUMBER', NULL, NULL, 5, '<5', NULL, 3),
    ('IVP0010', 'CT010', 'NSGCT markers', 'Germ Cell', 'BHCG', 'BHCG', 'NUMBER', NULL, 0, 5.3, '0 - 5.3', NULL, 1),
    ('IVP0011', 'CT010', 'NSGCT markers', 'Germ Cell', 'LDH', 'LDH', 'NUMBER', NULL, 0, 248, '0 - 248', NULL, 2),
    ('IVP0012', 'CT010', 'NSGCT markers', 'Germ Cell', 'AFP', 'AFP', 'NUMBER', NULL, 0, 5.5, '0 - 5.5', NULL, 3),
    -- CML (BCR-ABL)
    ('IVP0013', 'CT020', 'CML (BCR-ABL)', 'CML', 'RTPCR', 'RTPCR', 'NUMBER', '%', NULL, NULL, NULL, NULL, 1),
    ('IVP0014', 'CT020', 'CML (BCR-ABL)', 'CML', 'FISH', 'FISH', 'NUMBER', '%', NULL, NULL, NULL, NULL, 2),
    ('IVP0015', 'CT020', 'CML (BCR-ABL)', 'CML', 'IMATINIB_START', 'Imatinib Started Date', 'DATE', NULL, NULL, NULL, NULL, NULL, 3),
    ('IVP0016', 'CT020', 'CML (BCR-ABL)', 'CML', 'CYTOGENETICS', 'Cytogenetics Report', 'TEXT', NULL, NULL, NULL, NULL, NULL, 4),
    ('IVP0017', 'CT020', 'CML (BCR-ABL)', 'CML', 'NOTES', 'Notes', 'TEXT', NULL, NULL, NULL, NULL, NULL, 5),
    -- CLL
    ('IVP0018', 'CT020', 'CLL', 'CLL|SLL|Richter', 'HB', 'HB', 'NUMBER', NULL, NULL, NULL, NULL, NULL, 1),
    ('IVP0019', 'CT020', 'CLL', 'CLL|SLL|Richter', 'TC', 'TC', 'NUMBER', NULL, NULL, NULL, NULL, NULL, 2),
    ('IVP0020', 'CT020', 'CLL', 'CLL|SLL|Richter', 'PLT', 'PLT', 'NUMBER', NULL, NULL, NULL, NULL, NULL, 3),
    ('IVP0021', 'CT020', 'CLL', 'CLL|SLL|Richter', 'NOTES', 'Notes', 'TEXT', NULL, NULL, NULL, NULL, NULL, 4),
    -- PML-RARA (APL)
    ('IVP0022', 'CT020', 'PML-RARA', 'PML|APL', 'PML_RARA', 'PML/RARA t(15;17)', 'TEXT', NULL, NULL, NULL, NULL, NULL, 1),
    -- Ca Breast - Herceptin
    ('IVP0023', 'CT002', 'Ca Breast - Herceptin', 'HER2+|HER2-enriched', 'EF', 'EF', 'NUMBER', '%', NULL, NULL, NULL, NULL, 1),
    ('IVP0024', 'CT002', 'Ca Breast - Herceptin', 'HER2+|HER2-enriched', 'FS', 'FS', 'NUMBER', '%', NULL, NULL, NULL, NULL, 2),
    ('IVP0025', 'CT002', 'Ca Breast - Herceptin', 'HER2+|HER2-enriched', 'RWMA', 'RWMA', 'SELECT', NULL, NULL, NULL, NULL, '+|-', 3),
    ('IVP0026', 'CT002', 'Ca Breast - Herceptin', 'HER2+|HER2-enriched', 'HERCEPTIN_START', 'Herceptin Started Date', 'DATE', NULL, NULL, NULL, NULL, NULL, 4),
    -- Multiple Myeloma
    ('IVP0027', 'CT022', 'Multiple Myeloma', NULL, 'BMA_PLASMA', 'BMA Plasma Cell', 'NUMBER', '%', NULL, NULL, NULL, NULL, 1),
    ('IVP0028', 'CT022', 'Multiple Myeloma', NULL, 'M_COMPONENT', 'M-Component', 'TEXT', NULL, NULL, NULL, NULL, NULL, 2),
    ('IVP0029', 'CT022', 'Multiple Myeloma', NULL, 'FLC_RATIO', 'FLC Ratio', 'NUMBER', NULL, 0.26, 1.65, '0.26 - 1.65', NULL, 3),
    ('IVP0030', 'CT022', 'Multiple Myeloma', NULL, 'B2M', 'β2 Microglobulin', 'NUMBER', NULL, 609.0, 2366.0, '609.0 - 2366.0', NULL, 4),
    ('IVP0031', 'CT022', 'Multiple Myeloma', NULL, 'INVESTIGATION', 'Investigation', 'TEXT', NULL, NULL, NULL, NULL, NULL, 5),
    -- Ca Colon / Rectum (the sheet's three colon / rectum / stomach tabs merged)
    ('IVP0032', 'CT005', 'Ca Colon / Rectum', NULL, 'CEA', 'CEA', 'NUMBER', NULL, NULL, 5, '<5', NULL, 1),
    ('IVP0033', 'CT005', 'Ca Colon / Rectum', NULL, 'AFP', 'AFP', 'NUMBER', NULL, 0, 5.5, '0 - 5.5', NULL, 2),
    ('IVP0034', 'CT005', 'Ca Colon / Rectum', NULL, 'USG_AP', 'USG A/P', 'TEXT', NULL, NULL, NULL, NULL, NULL, 3),
    ('IVP0035', 'CT005', 'Ca Colon / Rectum', NULL, 'COLONOSCOPY', 'Colonoscopy', 'TEXT', NULL, NULL, NULL, NULL, NULL, 4),
    -- Ca Stomach
    ('IVP0036', 'CT007', 'Ca Stomach', NULL, 'CEA', 'CEA', 'NUMBER', NULL, NULL, 5, '<5', NULL, 1),
    -- DLBCL
    ('IVP0037', 'CT021', 'DLBCL', 'DLBCL', 'BMA_BMBX', 'BMA/BMBX', 'TEXT', NULL, NULL, NULL, NULL, NULL, 1),
    ('IVP0038', 'CT021', 'DLBCL', 'DLBCL', 'IHC', 'IHC', 'TEXT', NULL, NULL, NULL, NULL, NULL, 2),
    ('IVP0039', 'CT021', 'DLBCL', 'DLBCL', 'PET_CT', 'PET CT', 'TEXT', NULL, NULL, NULL, NULL, NULL, 3),
    ('IVP0040', 'CT021', 'DLBCL', 'DLBCL', 'FLOWCHART', 'Flowchart', 'TEXT', NULL, NULL, NULL, NULL, NULL, 4)
) AS v (parameter_id, cancer_type_id, chart_name, subtype_keywords, parameter_code, parameter_name,
        input_type, unit, normal_min, normal_max, range_label, select_options, display_order)
WHERE NOT EXISTS (SELECT 1 FROM public.investigation_parameter p WHERE p.parameter_id = v.parameter_id);

INSERT INTO public.id_sequences (entity_name, prefix, current_number)
SELECT 'INVESTIGATION_PARAMETER', 'IVP', 40
WHERE NOT EXISTS (SELECT 1 FROM public.id_sequences WHERE entity_name = 'INVESTIGATION_PARAMETER');

-- ------------------------------------- patient_investigation_result
CREATE TABLE IF NOT EXISTS public.patient_investigation_result (
    id                      BIGSERIAL PRIMARY KEY,
    investigation_result_id VARCHAR(100) NOT NULL,
    patient_id              VARCHAR(100) NOT NULL,
    -- The visit the result was entered in.
    encounter_no            VARCHAR(100) NOT NULL,
    -- The visit's staging detail, when the Diagnosis step saved one.
    staging_detail_id       VARCHAR(100),
    parameter_id            VARCHAR(100) NOT NULL,
    report_date             DATE NOT NULL,
    value_text              TEXT NOT NULL,
    value_numeric           NUMERIC(14, 4),
    -- Outside the parameter's normal range.
    is_abnormal             BOOLEAN NOT NULL DEFAULT FALSE,
    created_by              VARCHAR(100),
    created_at              TIMESTAMP(6) DEFAULT now(),
    updated_at              TIMESTAMP(6) DEFAULT now(),
    CONSTRAINT uq_investigation_result_id UNIQUE (investigation_result_id),
    CONSTRAINT uq_investigation_result_visit UNIQUE (encounter_no, parameter_id),
    CONSTRAINT fk_investigation_result_patient FOREIGN KEY (patient_id)
        REFERENCES public.patient_bio_data (patient_id) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT fk_investigation_result_encounter FOREIGN KEY (encounter_no)
        REFERENCES public.encounter (encounter_no) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT fk_investigation_result_staging FOREIGN KEY (staging_detail_id)
        REFERENCES public.oncology_staging_detail (staging_detail_id) ON DELETE SET NULL ON UPDATE NO ACTION,
    CONSTRAINT fk_investigation_result_parameter FOREIGN KEY (parameter_id)
        REFERENCES public.investigation_parameter (parameter_id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_investigation_result_patient
    ON public.patient_investigation_result (patient_id, report_date);

ALTER TABLE public.patient_investigation_result ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.patient_investigation_result FROM anon, authenticated, service_role;

INSERT INTO public.id_sequences (entity_name, prefix, current_number)
SELECT 'INVESTIGATION_RESULT', 'IVR', 0
WHERE NOT EXISTS (SELECT 1 FROM public.id_sequences WHERE entity_name = 'INVESTIGATION_RESULT');

COMMIT;
