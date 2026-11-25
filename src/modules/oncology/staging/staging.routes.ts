import { Router } from "express";
import { authenticate } from "../../auth/auth.middleware";
import { authorize, authorizeAny } from "../../../middleware/authorize";
import { StagingController } from "./staging.controller";
import {
    deriveStageValidation,
    getStagingSchemaValidation,
    listStageHistoryValidation,
    listStageRecordsValidation,
    listStagingSchemasValidation,
    saveStageRecordsValidation,
    stageRecordIdValidation,
} from "./staging.validation";

// TNM staging module. Mounted at /api/oncology/staging.
const router = Router();
const controller = new StagingController();

// Recording a stage is part of the Diagnosis step, so either of its
// permissions will do.
const writeAccess = authorizeAny("oncology.diagnosis.create", "oncology.diagnosis.update");

router.get(
    "/cancer-types/:cancerTypeId/schemas",
    authenticate,
    authorize("oncology.diagnosis.read"),
    listStagingSchemasValidation,
    controller.listSchemas.bind(controller)
);

router.get(
    "/schemas/:schemaId",
    authenticate,
    authorize("oncology.diagnosis.read"),
    getStagingSchemaValidation,
    controller.getSchema.bind(controller)
);

// Live preview and the authoritative derivation behind Save.
router.post(
    "/derive",
    authenticate,
    authorize("oncology.diagnosis.read"),
    deriveStageValidation,
    controller.derive.bind(controller)
);

router.get(
    "/records",
    authenticate,
    authorize("oncology.diagnosis.read"),
    listStageRecordsValidation,
    controller.listRecords.bind(controller)
);

router.put(
    "/records",
    authenticate,
    writeAccess,
    saveStageRecordsValidation,
    controller.saveRecords.bind(controller)
);

router.delete(
    "/records/:stageRecordId",
    authenticate,
    writeAccess,
    stageRecordIdValidation,
    controller.deleteRecord.bind(controller)
);

router.get(
    "/history",
    authenticate,
    authorize("oncology.diagnosis.read"),
    listStageHistoryValidation,
    controller.history.bind(controller)
);

export default router;
