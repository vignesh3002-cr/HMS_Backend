import { Router } from "express";
import { OncologyController } from "./oncology.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize, authorizeAny } from "../../middleware/authorize";
import {
    getCancerSubtypesValidation,
    getStagingReferenceValidation,
    createStagingDetailValidation,
    updateStagingDetailValidation,
    upsertIhcValidation,
    upsertMolecularValidation,
    getStagingDetailValidation,
    listStagingDetailsValidation,
    listInvestigationResultsValidation,
    saveInvestigationResultsValidation
} from "./oncology.validation";

const router = Router();
const controller = new OncologyController();

// ---------------- Reference lookups ----------------

router.get(
    "/reference/cancer-types",
    authenticate,
    authorize("oncology.reference.read"),
    controller.getCancerTypes.bind(controller)
);

router.get(
    "/reference/cancer-types/:cancerTypeId/subtypes",
    authenticate,
    authorize("oncology.reference.read"),
    getCancerSubtypesValidation,
    controller.getCancerSubtypes.bind(controller)
);

router.get(
    "/reference/cancer-types/:cancerTypeId/sites",
    authenticate,
    authorize("oncology.reference.read"),
    getCancerSubtypesValidation,
    controller.getAnatomicalSites.bind(controller)
);

router.get(
    "/reference/cancer-types/:cancerTypeId/grades",
    authenticate,
    authorize("oncology.reference.read"),
    getCancerSubtypesValidation,
    controller.getCancerGrades.bind(controller)
);

router.get(
    "/reference/cancer-types/:cancerTypeId/scores",
    authenticate,
    authorize("oncology.reference.read"),
    getCancerSubtypesValidation,
    controller.getCancerScores.bind(controller)
);

// The Investigation Results tests (tumour markers etc.) of a cancer type.
router.get(
    "/reference/cancer-types/:cancerTypeId/investigation-parameters",
    authenticate,
    authorize("oncology.reference.read"),
    getCancerSubtypesValidation,
    controller.getInvestigationParameters.bind(controller)
);

router.get(
    "/reference/staging",
    authenticate,
    authorize("oncology.reference.read"),
    getStagingReferenceValidation,
    controller.getStagingReference.bind(controller)
);

router.get(
    "/reference/biomarker-tests",
    authenticate,
    authorize("oncology.reference.read"),
    controller.getBiomarkerTests.bind(controller)
);

router.get(
    "/reference/molecular-subtypes",
    authenticate,
    authorize("oncology.reference.read"),
    controller.getMolecularSubtypes.bind(controller)
);

router.post(
    "/reference/reseed",
    authenticate,
    authorize("oncology.reference.manage"),
    controller.reseedReference.bind(controller)
);

// ---------------- Staging detail workflow ----------------

router.post(
    "/staging-details",
    authenticate,
    authorize("oncology.diagnosis.create"),
    createStagingDetailValidation,
    controller.createStagingDetail.bind(controller)
);

router.get(
    "/staging-details",
    authenticate,
    authorize("oncology.diagnosis.read"),
    listStagingDetailsValidation,
    controller.listStagingDetails.bind(controller)
);

router.get(
    "/staging-details/:stagingDetailId",
    authenticate,
    authorize("oncology.diagnosis.read"),
    getStagingDetailValidation,
    controller.getStagingDetail.bind(controller)
);

router.put(
    "/staging-details/:stagingDetailId",
    authenticate,
    authorize("oncology.diagnosis.update"),
    updateStagingDetailValidation,
    controller.updateStagingDetail.bind(controller)
);

router.put(
    "/staging-details/:stagingDetailId/ihc",
    authenticate,
    authorize("oncology.ihc.write"),
    upsertIhcValidation,
    controller.upsertIhc.bind(controller)
);

router.put(
    "/staging-details/:stagingDetailId/molecular",
    authenticate,
    authorize("oncology.molecular.write"),
    upsertMolecularValidation,
    controller.upsertMolecular.bind(controller)
);

router.get(
    "/staging-details/:stagingDetailId/derived",
    authenticate,
    authorize("oncology.derived.read"),
    getStagingDetailValidation,
    controller.getDerivedFields.bind(controller)
);

// ---------------- Investigation Results (per visit) ----------------

router.get(
    "/investigation-results",
    authenticate,
    authorize("oncology.diagnosis.read"),
    listInvestigationResultsValidation,
    controller.listInvestigationResults.bind(controller)
);

// Saved with the Diagnosis step, so either of its permissions will do.
router.put(
    "/investigation-results",
    authenticate,
    authorizeAny("oncology.diagnosis.create", "oncology.diagnosis.update"),
    saveInvestigationResultsValidation,
    controller.saveInvestigationResults.bind(controller)
);

export default router;
