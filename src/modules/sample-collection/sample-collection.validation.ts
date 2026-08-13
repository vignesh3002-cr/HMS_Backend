import { body } from "express-validator";

export const createSampleCollectionValidation = [

    body("lab_order_item_id")
        .notEmpty()
        .withMessage("Lab Order Item ID is required"),

    body("barcode")
        .optional()
        .isString()
        .withMessage("Barcode must be a string"),

    body("container_type")
        .optional()
        .isString()
        .withMessage("Container Type must be a string"),

    body("collection_datetime")
        .optional()
        .isISO8601()
        .withMessage("Collection DateTime must be valid"),

    body("collected_by")
        .optional()
        .isString()
        .withMessage("Collected By must be valid"),

    body("collection_site")
        .optional()
        .isString()
        .withMessage("Collection Site must be a string"),

    body("collected_volume")
        .optional()
        .isString()
        .withMessage("Collected Volume must be a string"),

    body("collection_status")
        .optional()
        .isIn([
            "Pending",
            "Collected",
            "Rejected"
        ])
        .withMessage("Invalid Collection Status"),

    body("rejection_reason")
        .optional()
        .isString(),

    body("remarks")
        .optional()
        .isString()

];

export const updateSampleCollectionValidation = [

    body("barcode").optional().isString(),

    body("container_type").optional().isString(),

    body("collection_datetime")
        .optional()
        .isISO8601(),

    body("collected_by")
        .optional()
        .isString(),

    body("collection_site")
        .optional()
        .isString(),

    body("collected_volume")
        .optional()
        .isString(),

    body("collection_status")
        .optional()
        .isIn([
            "Pending",
            "Collected",
            "Rejected"
        ]),

    body("rejection_reason")
        .optional()
        .isString(),

    body("remarks")
        .optional()
        .isString()

];