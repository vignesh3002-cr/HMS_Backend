"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PharmacyService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const audit_service_1 = require("../audit/audit.service");
const pharmacy_repository_1 = require("./pharmacy.repository");
const pharmacy_constants_1 = require("./pharmacy.constants");
const AUDIT_ENTITY = "pharmacy_slip";
// A Decimal in the DB prints as a string; the client renders numbers. Kept in
// one place so a slip row's quantity looks the same everywhere.
const asNumber = (value) => {
    if (value === null || value === undefined)
        return null;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};
const clean = (value) => {
    const trimmed = (value ?? "").trim();
    return trimmed === "" ? null : trimmed;
};
/*
 * A slip line's display name. Catalog lines take medicine_master.medicine_name
 * via the medicine_id they already carry; only a free-typed "Others" drug falls
 * back to the text the prescriber typed. The value is stored rather than joined
 * on read so printing a slip cannot rewrite the name of a dispensed one.
 */
const drugNameOf = (medicineId, freeText, medicine) => {
    if (medicineId)
        return clean(medicine?.medicine_name) ?? clean(freeText);
    return clean(freeText);
};
// The clinical dose as it prints: prefer the patient-specific calculated dose,
// fall back to the protocol's. Mirrors formatDose in the old client component.
const doseOf = (calculated, unit, fallback) => {
    const primary = asNumber(calculated);
    const value = primary ?? asNumber(fallback);
    if (value === null)
        return { dose: null, dose_unit: null };
    return {
        dose: String(Number(value.toFixed(2))),
        dose_unit: clean(unit)
    };
};
class PharmacyService {
    repository = new pharmacy_repository_1.PharmacyRepository();
    /*
     * A chemotherapy plan's current cycle-day order - the first still-ORDERED
     * day whose cycle is not terminal, else the latest one being administered,
     * else the latest COMPLETED one - falling
     * back to the plan's baseline (the protocol copy) when no order has been
     * saved yet. The protocol's take-home discharge medicines are appended
     * when the plan was built from a saved regimen.
     *
     * This is the browser-side PharmacySlip.tsx logic, moved server-side.
     */
    async resolveChemoPlan(planId) {
        const found = await this.repository.findPlanForPharmacy(planId);
        if (!found) {
            throw new Error("Chemotherapy plan not found");
        }
        const { plan, currentHeader, currentOrder } = found;
        const planItems = currentOrder?.chemotherapy_plan_items?.length
            ? currentOrder.chemotherapy_plan_items
            : plan.chemotherapy_plan_items;
        const lines = planItems.map((item) => {
            const medicine = item.medicine_master;
            const protoDoseObj = doseOf(item.calculated_dose, item.calculated_dose_unit ?? item.protocol_dose_unit, item.protocol_dose);
            const protoDoseText = protoDoseObj.dose ? `${protoDoseObj.dose}${protoDoseObj.dose_unit ? ` ${protoDoseObj.dose_unit}` : ""}` : null;
            const pharmMaster = medicine?.pharmacy_master?.[0];
            const brandName = clean(pharmMaster?.manufacturer_name ?? medicine?.brand_name);
            const dose = pharmMaster?.strength_value ? String(pharmMaster.strength_value) : (pharmMaster?.strength_text ?? protoDoseObj.dose);
            const doseUnit = pharmMaster?.strength_unit ?? protoDoseObj.dose_unit;
            return {
                medicine_id: item.medicine_id ?? null,
                drug_name: drugNameOf(item.medicine_id, item.drug_name, medicine),
                brand_name: brandName,
                patient_dose: protoDoseText,
                dose,
                dose_unit: doseUnit,
                // A chemo order's calculated_dose is the dose to administer,
                // not a pack quantity, so it is deliberately not copied into
                // quantity - the pharmacist fills that in.
                quantity: null,
                drug_role: clean(item.drug_role) ?? pharmacy_constants_1.PHARMACY_DRUG_ROLE.PRIMARY,
                route: clean(item.administration_route),
                frequency: clean(item.frequency),
                instructions: clean(item.administration_detail ?? item.remarks)
            };
        });
        const discharge = plan.chemotherapy_regimen_protocol?.chemotherapy_discharge_instructions ?? [];
        for (const instruction of discharge) {
            const medicine = instruction.medicine_master;
            const protoDoseObj = doseOf(instruction.patient_dose, instruction.patient_dose_unit, null);
            const protoDoseText = protoDoseObj.dose ? `${protoDoseObj.dose}${protoDoseObj.dose_unit ? ` ${protoDoseObj.dose_unit}` : ""}` : null;
            const pharmMaster = medicine?.pharmacy_master?.[0];
            const brandName = clean(pharmMaster?.manufacturer_name ?? instruction.drug_brand_name ?? medicine?.brand_name);
            const dose = pharmMaster?.strength_value ? String(pharmMaster.strength_value) : (pharmMaster?.strength_text ?? protoDoseObj.dose);
            const doseUnit = pharmMaster?.strength_unit ?? protoDoseObj.dose_unit;
            lines.push({
                medicine_id: instruction.medicine_id ?? null,
                drug_name: drugNameOf(instruction.medicine_id, instruction.drug_brand_name, medicine),
                brand_name: brandName,
                patient_dose: protoDoseText,
                dose,
                dose_unit: doseUnit,
                quantity: null,
                drug_role: pharmacy_constants_1.PHARMACY_DRUG_ROLE.DISCHARGE,
                frequency: clean(instruction.frequency),
                duration: clean(instruction.duration ?? instruction.duration_days),
                instructions: clean(instruction.administration_detail ?? instruction.comment)
            });
        }
        // One slip per visit: the consultation also writes a separate advice
        // prescription for the same appointment (analgesics, antiemetics, ...).
        // Without this the pharmacist would print the chemo drugs and miss
        // everything else the doctor ordered for the same visit.
        //
        // The visit is the current order's encounter, not the plan header: a
        // course spans many appointments and the header still names the visit
        // that started it. Preferring the encounter is what makes the slip and
        // its advice follow the patient to today's cycle.
        const encounterNo = currentOrder?.encounter_no ?? plan.encounter_no ?? null;
        const visit = await this.repository.findVisitForEncounter(encounterNo);
        // A plan is patient-scoped and an encounter is patient-scoped, so a
        // disagreeing encounter is stale data, not a different patient. Fall
        // back to the plan header rather than mixing visits.
        const visitMatchesPlan = !visit || !visit.patient_id || visit.patient_id === plan.patient_id;
        const safeVisit = visitMatchesPlan ? visit : null;
        const advice = await this.repository.findAdvicePrescription(safeVisit?.appointment_id ?? plan.appointment_id ?? null, plan.patient_id);
        if (advice) {
            lines.push(...this.prescriptionLines(advice.prescription_items));
        }
        return {
            lines,
            patient_id: plan.patient_id,
            branch_id: safeVisit?.branch_id ?? plan.branch_id,
            encounter_no: encounterNo,
            appointment_id: safeVisit?.appointment_id ?? plan.appointment_id ?? null,
            plan_order_id: currentHeader?.plan_order_id ?? null,
            cycle_number: currentHeader?.cycle_number ?? null,
            cycle_day: currentHeader?.cycle_day ?? null,
            protocol_name: plan.protocol_name
                ?? plan.chemotherapy_regimen_protocol?.regimen_name
                ?? null,
            regimen_name: plan.regimen_name
                ?? plan.chemotherapy_regimen_protocol?.regimen_name
                ?? null
        };
    }
    /*
     * prescription_items already carry a real quantity and unit, so these lines
     * are the closest to what the pharmacy needs of any source. drug_role is
     * kept as stamped so an advice prescription stays distinguishable from the
     * chemo prescription on the same visit.
     */
    prescriptionLines(items) {
        return items.map((item) => {
            const medicine = item.medicine_master;
            const protoDoseObj = doseOf(item.dosage, item.unit, null);
            const protoDoseText = protoDoseObj.dose ? `${protoDoseObj.dose}${protoDoseObj.dose_unit ? ` ${protoDoseObj.dose_unit}` : ""}` : null;
            const pharmMaster = medicine?.pharmacy_master?.[0];
            const brandName = clean(pharmMaster?.manufacturer_name ?? medicine?.brand_name);
            const dose = pharmMaster?.strength_value ? String(pharmMaster.strength_value) : (pharmMaster?.strength_text ?? protoDoseObj.dose);
            const doseUnit = pharmMaster?.strength_unit ?? protoDoseObj.dose_unit;
            return {
                medicine_id: item.medicine_id ?? null,
                drug_name: drugNameOf(item.medicine_id, item.drug_name, medicine),
                brand_name: brandName,
                patient_dose: protoDoseText,
                dose,
                dose_unit: doseUnit,
                // A prescription dosage is a pack count for advice
                // medicines, so it round-trips as the slip quantity.
                quantity: asNumber(item.quantity),
                drug_role: clean(item.drug_role),
                route: clean(item.route),
                frequency: clean(item.frequency),
                duration: clean(item.duration),
                instructions: clean(item.instruction)
            };
        });
    }
    // ---------------------------------------------------------------
    // Preview / create
    // ---------------------------------------------------------------
    async previewFromPlan(planId) {
        const resolved = await this.resolveChemoPlan(planId);
        // A slip already covering this cycle day wins over a fresh resolve: a
        // re-opened row must show what was actually dispensed, not whatever the
        // plan looks like today.
        const existing = resolved.plan_order_id
            ? await this.repository.findLiveSlipForOrder(resolved.plan_order_id)
            : null;
        if (existing && existing.pharmacy_slip_item) {
            const doseMap = new Map();
            for (const l of resolved.lines) {
                if (l.medicine_id)
                    doseMap.set(l.medicine_id, l.patient_dose ?? null);
            }
            for (let i = 0; i < existing.pharmacy_slip_item.length; i++) {
                const item = existing.pharmacy_slip_item[i];
                item.patient_dose = (item.medicine_id ? doseMap.get(item.medicine_id) : null) ?? resolved.lines[i]?.patient_dose ?? null;
            }
        }
        return { ...resolved, existing_slip: existing ?? null };
    }
    async createFromPlan(dto, actingUserId) {
        const resolved = await this.resolveChemoPlan(dto.plan_id);
        if (resolved.lines.length === 0) {
            throw new Error("This chemotherapy plan has no medicines to put on a pharmacy slip");
        }
        if (!resolved.plan_order_id) {
            throw new Error("Save this cycle day's chemotherapy order before creating its pharmacy slip");
        }
        const existing = await this.repository.findLiveSlipForOrder(resolved.plan_order_id);
        if (existing) {
            throw new Error(`A pharmacy slip already exists for this cycle day (${existing.pharmacy_slip_id}, ${existing.slip_status}). Cancel it first to print a replacement.`);
        }
        return prisma_1.default.$transaction(async (tx) => {
            const pharmacySlipId = await this.repository.generateSlipId(tx);
            const itemIds = await this.repository.generateSlipItemIds(tx, resolved.lines.length);
            const slip = await this.repository.createSlip(tx, {
                pharmacy_slip_id: pharmacySlipId,
                patient_id: resolved.patient_id,
                branch_id: resolved.branch_id,
                encounter_no: resolved.encounter_no ?? null,
                appointment_id: resolved.appointment_id ?? null,
                plan_order_id: resolved.plan_order_id ?? null,
                cycle_number: resolved.cycle_number ?? null,
                cycle_day: resolved.cycle_day ?? null,
                protocol_name: resolved.protocol_name ?? null,
                regimen_name: resolved.regimen_name ?? null,
                slip_status: pharmacy_constants_1.PHARMACY_SLIP_STATUS.DRAFT,
                created_by: actingUserId,
                updated_by: actingUserId
            });
            await this.repository.createSlipItems(tx, resolved.lines.map((line, index) => ({
                pharmacy_slip_item_id: itemIds[index],
                pharmacy_slip_id: pharmacySlipId,
                display_order: index,
                medicine_id: line.medicine_id ?? null,
                drug_name: line.drug_name ?? null,
                brand_name: line.brand_name ?? null,
                dose: line.dose ?? null,
                dose_unit: line.dose_unit ?? null,
                quantity: line.quantity ?? null,
                drug_role: line.drug_role ?? null,
                route: line.route ?? null,
                frequency: line.frequency ?? null,
                duration: line.duration ?? null,
                instructions: line.instructions ?? null
            })));
            await (0, audit_service_1.logAudit)(tx, {
                entity_type: AUDIT_ENTITY,
                entity_id: pharmacySlipId,
                action: "CREATE",
                performed_by: actingUserId,
                patient_id: resolved.patient_id,
                branch_id: resolved.branch_id,
                change_summary: (0, audit_service_1.summarizeCreate)({
                    plan_order_id: resolved.plan_order_id,
                    cycle_number: resolved.cycle_number,
                    cycle_day: resolved.cycle_day,
                    item_count: resolved.lines.length
                })
            });
            return slip;
        }, { timeout: 30000 }).then(async (slip) => {
            const full = await this.repository.findSlipById(slip.pharmacy_slip_id);
            return full;
        });
    }
    // ---------------------------------------------------------------
    // Reads
    // ---------------------------------------------------------------
    async getSlip(pharmacySlipId) {
        const slip = await this.repository.findSlipById(pharmacySlipId);
        if (!slip) {
            throw new Error("Pharmacy slip not found");
        }
        return slip;
    }
    async listSlips(query) {
        return this.repository.listSlips(query);
    }
    // ---------------------------------------------------------------
    // Lifecycle
    // ---------------------------------------------------------------
    async updateItems(pharmacySlipId, dto, actingUserId) {
        return prisma_1.default.$transaction(async (tx) => {
            const existing = await this.requireSlip(tx, pharmacySlipId);
            if (!pharmacy_constants_1.PHARMACY_SLIP_EDITABLE_STATUSES.includes(existing.slip_status)) {
                // Printing is what freezes a slip, so "was printed" is the
                // accurate thing to tell the pharmacist here.
                const frozenBecause = existing.slip_status === pharmacy_constants_1.PHARMACY_SLIP_STATUS.CANCELLED
                    ? "is cancelled"
                    : "has already been printed";
                throw new Error(`This pharmacy slip can no longer be edited because it ${frozenBecause}. ${existing.slip_status === pharmacy_constants_1.PHARMACY_SLIP_STATUS.CANCELLED ? "Create a new slip instead." : "Cancel it to print a replacement."}`);
            }
            const existingItemsDto = dto.items.filter((item) => item.pharmacy_slip_item_id && !item.pharmacy_slip_item_id.startsWith("new-") && !item.pharmacy_slip_item_id.startsWith("pending-"));
            const newItemsDto = dto.items.filter((item) => !item.pharmacy_slip_item_id || item.pharmacy_slip_item_id.startsWith("new-") || item.pharmacy_slip_item_id.startsWith("pending-"));
            const existingIds = existingItemsDto.map((item) => item.pharmacy_slip_item_id);
            const owned = await this.assertItemsBelongToSlip(tx, pharmacySlipId, existingIds);
            const changes = {};
            for (let i = 0; i < existingItemsDto.length; i++) {
                const item = existingItemsDto[i];
                const before = owned.get(item.pharmacy_slip_item_id);
                const patch = {
                    updated_at: new Date(),
                    display_order: i
                };
                if (item.quantity !== undefined)
                    patch.quantity = item.quantity;
                if (item.brand_name !== undefined)
                    patch.brand_name = clean(item.brand_name);
                if (item.dose !== undefined)
                    patch.dose = clean(item.dose);
                if (item.dose_unit !== undefined)
                    patch.dose_unit = clean(item.dose_unit);
                if (item.drug_role !== undefined)
                    patch.drug_role = clean(item.drug_role);
                if (item.pharmacy_item_id !== undefined)
                    patch.pharmacy_item_id = clean(item.pharmacy_item_id);
                await tx.pharmacy_slip_item.update({
                    where: { pharmacy_slip_item_id: item.pharmacy_slip_item_id },
                    data: patch
                });
                Object.assign(changes, {
                    [`item:${item.pharmacy_slip_item_id}`]: {
                        quantity: patch.quantity ?? before.quantity,
                        dose: patch.dose ?? before.dose,
                        dose_unit: patch.dose_unit ?? before.dose_unit,
                        brand_name: patch.brand_name ?? before.brand_name
                    }
                });
            }
            if (newItemsDto.length > 0) {
                const newItemIds = await this.repository.generateSlipItemIds(tx, newItemsDto.length);
                const startIndex = existingItemsDto.length;
                for (let i = 0; i < newItemsDto.length; i++) {
                    const item = newItemsDto[i];
                    const generatedId = newItemIds[i];
                    await tx.pharmacy_slip_item.create({
                        data: {
                            pharmacy_slip_item_id: generatedId,
                            pharmacy_slip_id: pharmacySlipId,
                            display_order: startIndex + i,
                            medicine_id: clean(item.medicine_id),
                            drug_name: clean(item.drug_name),
                            brand_name: clean(item.brand_name),
                            dose: clean(item.dose),
                            dose_unit: clean(item.dose_unit),
                            quantity: item.quantity ?? null,
                            drug_role: clean(item.drug_role) ?? pharmacy_constants_1.PHARMACY_DRUG_ROLE.PRIMARY,
                            route: clean(item.route),
                            frequency: clean(item.frequency),
                            duration: clean(item.duration),
                            instructions: clean(item.instructions),
                            pharmacy_item_id: clean(item.pharmacy_item_id)
                        }
                    });
                    Object.assign(changes, {
                        [`item:${generatedId}:created`]: {
                            drug_name: item.drug_name,
                            brand_name: item.brand_name,
                            dose: item.dose,
                            dose_unit: item.dose_unit,
                            quantity: item.quantity
                        }
                    });
                }
            }
            // Omitted lines are the ones the user deleted in the UI.
            await this.repository.deleteSlipItems(tx, pharmacySlipId, existingIds);
            await (0, audit_service_1.logAudit)(tx, {
                entity_type: AUDIT_ENTITY,
                entity_id: pharmacySlipId,
                action: "UPDATE",
                performed_by: actingUserId,
                patient_id: existing.patient_id,
                branch_id: existing.branch_id,
                change_summary: (0, audit_service_1.diffFields)({}, changes)
            });
            return pharmacySlipId;
        }, { timeout: 30000 }).then(() => this.getSlip(pharmacySlipId));
    }
    async cancel(pharmacySlipId, dto, actingUserId) {
        const reason = clean(dto.reason);
        if (!reason) {
            throw new Error("A cancellation reason is required");
        }
        return prisma_1.default.$transaction(async (tx) => {
            const existing = await this.requireSlip(tx, pharmacySlipId);
            this.assertTransition(existing.slip_status, pharmacy_constants_1.PHARMACY_SLIP_STATUS.CANCELLED);
            const now = new Date();
            await this.repository.updateSlip(tx, pharmacySlipId, {
                slip_status: pharmacy_constants_1.PHARMACY_SLIP_STATUS.CANCELLED,
                // The DB check ties ISSUED to issued_at, so a cancelled slip
                // that was issued keeps its original timestamp - only clear it
                // when it was never issued.
                ...(existing.slip_status === pharmacy_constants_1.PHARMACY_SLIP_STATUS.ISSUED
                    ? {}
                    : { issued_at: null, issued_by: null }),
                cancelled_at: now,
                cancelled_by: actingUserId,
                cancellation_reason: reason,
                updated_by: actingUserId,
                updated_at: now
            });
            await (0, audit_service_1.logAudit)(tx, {
                entity_type: AUDIT_ENTITY,
                entity_id: pharmacySlipId,
                action: "STATUS_CHANGE",
                performed_by: actingUserId,
                patient_id: existing.patient_id,
                branch_id: existing.branch_id,
                change_summary: (0, audit_service_1.summarizeStatusChange)(existing.slip_status, pharmacy_constants_1.PHARMACY_SLIP_STATUS.CANCELLED, reason)
            });
            return pharmacySlipId;
        }, { timeout: 30000 }).then(() => this.getSlip(pharmacySlipId));
    }
    /*
     * Printing is what finalises a slip: there is no separate issue step, so the
     * first print moves a DRAFT to ISSUED and freezes its lines. A reprint only
     * restamps printed_at, which stays visible in the audit trail as a second
     * PRINT entry.
     */
    async markPrinted(pharmacySlipId, dto, actingUserId) {
        return prisma_1.default.$transaction(async (tx) => {
            const existing = await this.requireSlip(tx, pharmacySlipId);
            if (existing.slip_status === pharmacy_constants_1.PHARMACY_SLIP_STATUS.CANCELLED) {
                throw new Error("A cancelled pharmacy slip cannot be printed");
            }
            if (existing.slip_status === pharmacy_constants_1.PHARMACY_SLIP_STATUS.DRAFT) {
                const remaining = await tx.pharmacy_slip_item.count({
                    where: { pharmacy_slip_id: pharmacySlipId }
                });
                if (remaining === 0) {
                    throw new Error("This pharmacy slip has no medicine lines to print");
                }
                this.assertTransition(existing.slip_status, pharmacy_constants_1.PHARMACY_SLIP_STATUS.ISSUED);
            }
            const printedBy = clean(dto.printed_by) ?? actingUserId;
            const now = new Date();
            const firstPrint = existing.slip_status === pharmacy_constants_1.PHARMACY_SLIP_STATUS.DRAFT;
            await this.repository.updateSlip(tx, pharmacySlipId, {
                ...(firstPrint
                    ? {
                        slip_status: pharmacy_constants_1.PHARMACY_SLIP_STATUS.ISSUED,
                        issued_at: now,
                        issued_by: actingUserId
                    }
                    : {}),
                printed_at: now,
                printed_by: printedBy,
                updated_by: actingUserId,
                updated_at: now
            });
            await (0, audit_service_1.logAudit)(tx, {
                entity_type: AUDIT_ENTITY,
                entity_id: pharmacySlipId,
                action: "PRINT",
                performed_by: printedBy,
                patient_id: existing.patient_id,
                branch_id: existing.branch_id,
                change_summary: firstPrint
                    ? (0, audit_service_1.summarizeStatusChange)(existing.slip_status, pharmacy_constants_1.PHARMACY_SLIP_STATUS.ISSUED, "printed")
                    : "printed (reprint)"
            });
            return pharmacySlipId;
        }, { timeout: 30000 }).then(() => this.getSlip(pharmacySlipId));
    }
    // ---------------------------------------------------------------
    // Guards
    // ---------------------------------------------------------------
    async requireSlip(tx, pharmacySlipId) {
        const slip = await tx.pharmacy_slip.findUnique({
            where: { pharmacy_slip_id: pharmacySlipId }
        });
        if (!slip) {
            throw new Error("Pharmacy slip not found");
        }
        return slip;
    }
    assertTransition(from, to) {
        const allowed = pharmacy_constants_1.PHARMACY_SLIP_STATUS_TRANSITIONS[from] ?? [];
        if (!allowed.includes(to)) {
            throw new Error(`A ${String(from).toLowerCase()} pharmacy slip cannot become ${String(to).toLowerCase()}`);
        }
    }
    /*
     * An item id the caller sent must belong to this slip. Without this a
     * crafted body could rewrite quantity on some other patient's slip.
     */
    async assertItemsBelongToSlip(tx, pharmacySlipId, itemIds) {
        if (itemIds.length === 0)
            return new Map();
        const rows = await tx.pharmacy_slip_item.findMany({
            where: { pharmacy_slip_id: pharmacySlipId, pharmacy_slip_item_id: { in: itemIds } }
        });
        if (rows.length !== itemIds.length) {
            throw new Error("One or more slip items do not belong to this pharmacy slip");
        }
        return new Map(rows.map((row) => [row.pharmacy_slip_item_id, row]));
    }
    // ---------------------------------------------------------------
    // Pharmacy Master & Medicine Master
    // ---------------------------------------------------------------
    async listPharmacyMasterItems(medicineIds) {
        return this.repository.findPharmacyMasterItems(medicineIds);
    }
    async createMedicine(dto, actingUserId) {
        if (!dto.medicine_name?.trim()) {
            throw new Error("Medicine name is required");
        }
        const med = await this.repository.createMedicineInMaster({
            medicine_name: dto.medicine_name.trim(),
            generic_name: dto.generic_name?.trim() || null,
            dosage_form: dto.dosage_form?.trim() || null
        });
        return med;
    }
}
exports.PharmacyService = PharmacyService;
