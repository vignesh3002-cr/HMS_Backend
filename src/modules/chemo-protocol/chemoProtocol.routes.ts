import { Router } from "express";
import { ChemoProtocolController } from "./chemoProtocol.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../../middleware/authorize";
import {
    createProtocolValidation,
    updateProtocolValidation,
    addProtocolDrugValidation,
    updateProtocolDrugValidation
} from "./chemoProtocol.validation";

const router = Router();

const controller = new ChemoProtocolController();

router.get(
    "/",
    authenticate,
    controller.getProtocols.bind(controller)
);

router.get(
    "/:protocolId",
    authenticate,
    controller.getProtocolById.bind(controller)
);

router.post(
    "/",
    authenticate,
    authorize("ADMIN", "DOCTOR"),
    createProtocolValidation,
    controller.createProtocol.bind(controller)
);

router.put(
    "/:protocolId",
    authenticate,
    authorize("ADMIN", "DOCTOR"),
    updateProtocolValidation,
    controller.updateProtocol.bind(controller)
);

router.delete(
    "/:protocolId",
    authenticate,
    authorize("ADMIN"),
    controller.deleteProtocol.bind(controller)
);

router.patch(
    "/:protocolId/restore",
    authenticate,
    authorize("ADMIN"),
    controller.restoreProtocol.bind(controller)
);

// ---- Protocol <-> Drug bridge (chemo_protocol_drug) ----

router.post(
    "/:protocolId/drugs",
    authenticate,
    authorize("ADMIN", "DOCTOR"),
    addProtocolDrugValidation,
    controller.addDrugToProtocol.bind(controller)
);

router.put(
    "/drugs/:protocolDrugId",
    authenticate,
    authorize("ADMIN", "DOCTOR"),
    updateProtocolDrugValidation,
    controller.updateProtocolDrug.bind(controller)
);

router.delete(
    "/drugs/:protocolDrugId",
    authenticate,
    authorize("ADMIN", "DOCTOR"),
    controller.removeDrugFromProtocol.bind(controller)
);

export default router;
