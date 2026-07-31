import { Router } from "express";
import * as chemotherapyController from "./chemotherapy.controller";

const router = Router();

console.log("🔥 CHEMOTHERAPY ROUTE FILE LOADED");

router.get("/cancer-types", chemotherapyController.getCancerTypes);

router.post("/cancer-type", chemotherapyController.addCancerType);

export default router;