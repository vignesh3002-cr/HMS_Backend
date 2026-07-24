import { body } from "express-validator";

export const createDiagnosisValidation = [

    body("patient_id")
        .notEmpty()
        .withMessage("patient_id is required"),

    body("branch_id")
        .optional()
        .isString(),

    body("department_id")
        .optional()
        .isString(),

    body("diagnosing_doctor_id")
        .optional()
        .isString(),

    body("cancer_type_id")
        .optional()
        .isString(),

    body("cancer_stage_id")
        .optional()
        .isString(),

    body("tnm_stage_id")
        .optional()
        .isString(),

    body("histomorphology_id")
        .optional()
        .isString(),

    body("histological_grade_id")
        .optional()
        .isString(),

    body("icd_code_id")
        .optional()
        .isString(),

    body("primary_site")
        .optional()
        .isLength({ max: 200 }),

    body("laterality")
        .optional()
        .isIn(["Left", "Right", "Bilateral", "Not Applicable"])
        .withMessage(
            "laterality must be one of Left, Right, Bilateral, Not Applicable"
        ),

    body("diagnosis_date")
        .optional()
        .isISO8601()
        .withMessage("diagnosis_date must be a valid date"),

    body("diagnosis_basis")
        .optional()
        .isIn(["Histopathology", "Cytology", "Radiology", "Clinical", "Other"])
        .withMessage(
            "diagnosis_basis must be one of Histopathology, Cytology, Radiology, Clinical, Other"
        ),

    body("clinical_notes")
        .optional()
        .isString()

];

export const updateDiagnosisValidation = [

    body("diagnosis_date")
        .optional()
        .isISO8601()
        .withMessage("diagnosis_date must be a valid date"),

    body("laterality")
        .optional()
        .isIn(["Left", "Right", "Bilateral", "Not Applicable"]),

    body("diagnosis_basis")
        .optional()
        .isIn(["Histopathology", "Cytology", "Radiology", "Clinical", "Other"]),

    body("diagnosis_status")
        .optional()
        .isIn(["Active", "Revised", "Resolved"])
        .withMessage("diagnosis_status must be one of Active, Revised, Resolved"),

    body("is_active")
        .optional()
        .isBoolean()
        .withMessage("is_active must be a boolean")

];
