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
    admitAdmissionValidation,
    reserveBedValidation,
    closePlannedValidation,
    createDaycareValidation,
    daycareOccupancyValidation,
    getAdmissionsValidation,
    getAdmissionByIpNumberValidation,
    createWardValidation,
    createBedValidation,
    updateWardValidation,
    updateBedValidation,
    updateBedStatusValidation,
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

// Daycare booking (doctor slot + planned daycare admission) and the ward
// capacity view the booking form uses to hide full slots.
router.post(
    "/daycare",
    authenticate,
    authorize("admission.create"),
    createDaycareValidation,
    controller.bookDaycare.bind(controller)
);

router.get(
    "/daycare/occupancy",
    authenticate,
    authorize("admission.read"),
    daycareOccupancyValidation,
    controller.getDaycareOccupancy.bind(controller)
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

router.patch(
    "/wards/:wardId",
    authenticate,
    authorizeAny("ward.manage", "admission.create"),
    branchScope,
    updateWardValidation,
    controller.updateWard.bind(controller)
);

router.delete(
    "/wards/:wardId",
    authenticate,
    authorizeAny("ward.manage", "admission.create"),
    branchScope,
    controller.deleteWard.bind(controller)
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

router.patch(
    "/beds/:bedId",
    authenticate,
    authorizeAny("bed.manage", "admission.create"),
    branchScope,
    updateBedValidation,
    controller.updateBed.bind(controller)
);

router.delete(
    "/beds/:bedId",
    authenticate,
    authorizeAny("bed.manage", "admission.create"),
    branchScope,
    controller.deleteBed.bind(controller)
);

router.patch(
    "/beds/:id/status",
    authenticate,
    authorizeAny("bed.manage", "admission.create"),
    branchScope,
    updateBedStatusValidation,
    controller.updateBedStatus.bind(controller)
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

// Status transitions have dedicated endpoints -- PATCH /:id only edits details.
router.post(
    "/:id/admit",
    authenticate,
    authorize("admission.update"),
    admitAdmissionValidation,
    controller.admitAdmission.bind(controller)
);

router.post(
    "/:id/cancel",
    authenticate,
    authorize("admission.update"),
    closePlannedValidation,
    controller.cancelAdmission.bind(controller)
);

router.post(
    "/:id/no-show",
    authenticate,
    authorize("admission.update"),
    closePlannedValidation,
    controller.markNoShow.bind(controller)
);

router.post(
    "/:id/reserve",
    authenticate,
    authorize("admission.update"),
    reserveBedValidation,
    controller.reserveBed.bind(controller)
);

router.post(
    "/:id/release-reservation",
    authenticate,
    authorize("admission.update"),
    controller.releaseReservation.bind(controller)
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

