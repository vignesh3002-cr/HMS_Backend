import { Router } from "express";
import { IpdController } from "./ipd.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize, authorizeAny } from "../../middleware/authorize";
import { branchScope } from "../../middleware/branchScope";
import {
    createAdmissionValidation,
    updateAdmissionValidation,
    dischargeAdmissionValidation,
    transferAdmissionValidation,
    getAdmissionsValidation,
    getAdmissionByIpNumberValidation,
    createWardValidation,
    createBedValidation,
} from "./ipd.validation";

const router = Router();

const controller = new IpdController();

router.post(
    "/",
    authenticate,
    authorize("admission.create"),
    createAdmissionValidation,
    controller.createAdmission.bind(controller)
);

router.get(
    "/",
    authenticate,
    authorize("admission.read"),
    branchScope,
    getAdmissionsValidation,
    controller.listAdmissions.bind(controller)
);

router.get(
    "/stats/patients-today",
    authenticate,
    authorize("admission.read"),
    branchScope,
    controller.getAdmittedPatientsToday.bind(controller)
);

router.get(
    "/stats/overview",
    authenticate,
    authorize("admission.read"),
    branchScope,
    controller.getIpdOverview.bind(controller)
);

router.get(
    "/wards",
    authenticate,
    authorize("admission.read"),
    branchScope,
    controller.listWards.bind(controller)
);

router.post(
    "/wards",
    authenticate,
    authorizeAny("ward.manage", "admission.create"),
    branchScope,
    createWardValidation,
    controller.createWard.bind(controller)
);

router.get(
    "/beds",
    authenticate,
    authorize("admission.read"),
    branchScope,
    controller.listBeds.bind(controller)
);

router.post(
    "/beds",
    authenticate,
    authorizeAny("bed.manage", "admission.create"),
    branchScope,
    createBedValidation,
    controller.createBed.bind(controller)
);

router.get(
    "/:ipNumber",
    authenticate,
    authorize("admission.read"),
    getAdmissionByIpNumberValidation,
    controller.getAdmissionByIpNumber.bind(controller)
);

router.patch(
    "/:id",
    authenticate,
    authorize("admission.update"),
    updateAdmissionValidation,
    controller.updateAdmission.bind(controller)
);

router.post(
    "/:id/discharge",
    authenticate,
    authorize("admission.discharge"),
    dischargeAdmissionValidation,
    controller.dischargeAdmission.bind(controller)
);

router.post(
    "/:id/transfer",
    authenticate,
    authorize("admission.transfer"),
    transferAdmissionValidation,
    controller.transferAdmission.bind(controller)
);

export default router;

