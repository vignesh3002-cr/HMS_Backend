import { body } from "express-validator";

export const createPatientValidation = [

    body("username")
        .notEmpty(),

    body("password")
        .isLength({ min: 6 }),

    body("first_name")
        .notEmpty(),

    body("mobile")
        .isMobilePhone("any"),

    body("branch_id")
        .notEmpty(),

    body("created_by")
        .notEmpty()

];