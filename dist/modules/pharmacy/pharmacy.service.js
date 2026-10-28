"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PharmacyService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const caseFormatters_1 = require("../../utils/caseFormatters");
const audit_types_1 = require("../audit/audit.types");
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
        const discharge = plan.chemotherapy_regimen_protocol?.chemotherapy_discharge_instructions ?? [];
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
        const adviceItems = (advice?.prescription_items ?? []);
        const allMedIds = [
            ...planItems.map((item) => item.medicine_id),
            ...discharge.map((instruction) => instruction.medicine_id),
            ...adviceItems.map((item) => item.medicine_id)
        ].filter((id) => Boolean(id));
        const uniqueMedIds = Array.from(new Set(allMedIds));
        const pharmItems = uniqueMedIds.length > 0 ? await this.repository.findPharmacyMasterItems(uniqueMedIds) : [];
        const pharmMasterMap = new Map();
        for (const pi of pharmItems) {
            if (pi.medicine_id && !pharmMasterMap.has(pi.medicine_id)) {
                pharmMasterMap.set(pi.medicine_id, pi);
            }
        }
        const lines = planItems.map((item) => {
            const medicine = item.medicine_master;
            const protoDoseObj = doseOf(item.calculated_dose, item.calculated_dose_unit ?? item.protocol_dose_unit, item.protocol_dose);
            const protoDoseText = protoDoseObj.dose ? `${protoDoseObj.dose}${protoDoseObj.dose_unit ? ` ${protoDoseObj.dose_unit}` : ""}` : null;
            const pharmMaster = item.medicine_id ? pharmMasterMap.get(item.medicine_id) : null;
            const brandName = clean(pharmMaster?.brand_name ?? pharmMaster?.manufacturer_name ?? medicine?.brand_name);
            const dose = pharmMaster?.strength_value ? String(pharmMaster.strength_value) : (pharmMaster?.strength_text ?? protoDoseObj.dose);
            const doseUnit = pharmMaster?.strength_unit ?? protoDoseObj.dose_unit;
            const patientDoseNum = asNumber(item.calculated_dose ?? item.protocol_dose);
            const strengthNum = asNumber(dose);
            const defaultQty = (patientDoseNum && strengthNum && strengthNum > 0)
                ? Math.max(1, Math.ceil(patientDoseNum / strengthNum))
                : 1;
            return {
                medicine_id: item.medicine_id ?? null,
                drug_name: drugNameOf(item.medicine_id, item.drug_name, medicine),
                brand_name: brandName,
                patient_dose: protoDoseText,
                dose,
                dose_unit: doseUnit,
                quantity: defaultQty,
                drug_role: clean(item.drug_role) ?? pharmacy_constants_1.PHARMACY_DRUG_ROLE.PRIMARY,
                route: clean(item.administration_route),
                frequency: clean(item.frequency),
                instructions: clean(item.administration_detail ?? item.remarks)
            };
        });
        for (const instruction of discharge) {
            const medicine = instruction.medicine_master;
            const protoDoseObj = doseOf(instruction.patient_dose, instruction.patient_dose_unit, null);
            const protoDoseText = protoDoseObj.dose ? `${protoDoseObj.dose}${protoDoseObj.dose_unit ? ` ${protoDoseObj.dose_unit}` : ""}` : null;
            const pharmMaster = instruction.medicine_id ? pharmMasterMap.get(instruction.medicine_id) : null;
            const brandName = clean(pharmMaster?.brand_name ?? pharmMaster?.manufacturer_name ?? instruction.drug_brand_name ?? medicine?.brand_name);
            const dose = pharmMaster?.strength_value ? String(pharmMaster.strength_value) : (pharmMaster?.strength_text ?? protoDoseObj.dose);
            const doseUnit = pharmMaster?.strength_unit ?? protoDoseObj.dose_unit;
            const disPatientDoseNum = asNumber(instruction.patient_dose);
            const disStrengthNum = asNumber(dose);
            const disDefaultQty = (disPatientDoseNum && disStrengthNum && disStrengthNum > 0)
                ? Math.max(1, Math.ceil(disPatientDoseNum / disStrengthNum))
                : 1;
            lines.push({
                medicine_id: instruction.medicine_id ?? null,
                drug_name: drugNameOf(instruction.medicine_id, instruction.drug_brand_name, medicine),
                brand_name: brandName,
                patient_dose: protoDoseText,
                dose,
                dose_unit: doseUnit,
                quantity: disDefaultQty,
                drug_role: pharmacy_constants_1.PHARMACY_DRUG_ROLE.DISCHARGE,
                frequency: clean(instruction.frequency),
                duration: clean(instruction.duration ?? instruction.duration_days),
                instructions: clean(instruction.administration_detail ?? instruction.comment)
            });
        }
        if (advice) {
            lines.push(...this.prescriptionLines(adviceItems, pharmMasterMap));
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
    prescriptionLines(items, pharmMasterMap) {
        return items.map((item) => {
            const medicine = item.medicine_master;
            const protoDoseObj = doseOf(item.dosage, item.unit, null);
            const protoDoseText = protoDoseObj.dose ? `${protoDoseObj.dose}${protoDoseObj.dose_unit ? ` ${protoDoseObj.dose_unit}` : ""}` : null;
            const pharmMaster = item.medicine_id ? pharmMasterMap?.get(item.medicine_id) : null;
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
    // ---------------------------------------------------------------
    // Item mutation helper
    // ---------------------------------------------------------------
    async resolveOrCreatePharmacyMasterItem(tx, item, branchId) {
        const medId = clean(item.medicine_id);
        const brandName = (0, caseFormatters_1.toProperCase)(clean(item.brand_name));
        const dose = clean(item.dose);
        const doseUnit = clean(item.dose_unit);
        if (item.pharmacy_item_id) {
            const found = await tx.pharmacy_master.findUnique({
                where: { pharmacy_item_id: item.pharmacy_item_id }
            });
            if (found)
                return found.pharmacy_item_id;
        }
        if (!brandName || !dose) {
            return null;
        }
        const doseNum = !isNaN(Number(dose)) && Number(dose) > 0 ? Number(dose) : null;
        const candidates = await tx.pharmacy_master.findMany({
            where: {
                ...(medId ? { medicine_id: medId } : {}),
                OR: [
                    { manufacturer_name: { equals: brandName, mode: "insensitive" } },
                    { brand_name: { equals: brandName, mode: "insensitive" } }
                ],
                is_active: true
            }
        });
        const matched = candidates.find((c) => {
            const unitMatch = !doseUnit || !c.strength_unit || c.strength_unit.toLowerCase() === doseUnit.toLowerCase();
            const doseMatch = c.strength_value != null && Number(c.strength_value) === Number(dose);
            return unitMatch && doseMatch;
        });
        if (matched) {
            return matched.pharmacy_item_id;
        }
        const newPharmItemId = await this.repository.generatePharmacyItemId(tx);
        const drugName = clean(item.drug_name) || "Medicine";
        const strengthText = `${dose} ${doseUnit || ""}`.trim();
        const created = await tx.pharmacy_master.create({
            data: {
                pharmacy_item_id: newPharmItemId,
                medicine_id: medId || null,
                item_name: `${drugName} (${brandName}) ${strengthText}`.trim(),
                brand_name: brandName,
                manufacturer_name: brandName,
                strength_value: doseNum,
                strength_unit: doseUnit || null,
                strength_text: strengthText || null,
                branch_id: branchId || null,
                is_active: true,
                needs_review: true,
                created_by: "system"
            }
        });
        return created.pharmacy_item_id;
    }
    async applyItemChanges(tx, slip, items, opts) {
        const existingItemsDto = items.filter((item) => item.pharmacy_slip_item_id && !item.pharmacy_slip_item_id.startsWith("new-") && !item.pharmacy_slip_item_id.startsWith("pending-"));
        const newItemsDto = items.filter((item) => !item.pharmacy_slip_item_id || item.pharmacy_slip_item_id.startsWith("new-") || item.pharmacy_slip_item_id.startsWith("pending-"));
        if (!opts.allowAdd && newItemsDto.length > 0) {
            throw new Error("Amending an issued slip cannot add new medicine lines. Cancel and recreate the slip instead.");
        }
        const existingIds = existingItemsDto.map((item) => item.pharmacy_slip_item_id);
        const owned = await this.assertItemsBelongToSlip(tx, slip.pharmacy_slip_id, existingIds);
        if (!opts.allowDelete) {
            const allCurrentItems = await tx.pharmacy_slip_item.findMany({
                where: { pharmacy_slip_id: slip.pharmacy_slip_id },
                select: { pharmacy_slip_item_id: true }
            });
            const submittedSet = new Set(existingIds);
            const hasMissing = allCurrentItems.some((item) => !submittedSet.has(item.pharmacy_slip_item_id));
            if (hasMissing) {
                throw new Error("Amending an issued slip cannot remove medicine lines. Cancel the slip instead.");
            }
        }
        const changes = {};
        const before = {};
        for (let i = 0; i < existingItemsDto.length; i++) {
            const item = existingItemsDto[i];
            const prev = owned.get(item.pharmacy_slip_item_id);
            before[`item:${item.pharmacy_slip_item_id}`] = {
                quantity: prev.quantity,
                dose: prev.dose,
                dose_unit: prev.dose_unit,
                brand_name: prev.brand_name,
                drug_name: prev.drug_name,
                drug_role: prev.drug_role
            };
            const patch = {
                updated_at: new Date(),
                display_order: i
            };
            if (item.quantity !== undefined)
                patch.quantity = item.quantity;
            if (item.brand_name !== undefined)
                patch.brand_name = (0, caseFormatters_1.toProperCase)(clean(item.brand_name));
            if (item.dose !== undefined)
                patch.dose = clean(item.dose);
            if (item.dose_unit !== undefined)
                patch.dose_unit = clean(item.dose_unit);
            if (item.drug_role !== undefined)
                patch.drug_role = clean(item.drug_role);
            const resolvedPharmItemId = await this.resolveOrCreatePharmacyMasterItem(tx, {
                medicine_id: prev.medicine_id,
                drug_name: prev.drug_name,
                brand_name: item.brand_name !== undefined ? (0, caseFormatters_1.toProperCase)(item.brand_name) : prev.brand_name,
                dose: item.dose !== undefined ? item.dose : prev.dose,
                dose_unit: item.dose_unit !== undefined ? item.dose_unit : prev.dose_unit,
                pharmacy_item_id: item.pharmacy_item_id
            }, slip.branch_id);
            if (resolvedPharmItemId) {
                patch.pharmacy_item_id = resolvedPharmItemId;
            }
            else if (item.pharmacy_item_id !== undefined) {
                patch.pharmacy_item_id = clean(item.pharmacy_item_id);
            }
            await tx.pharmacy_slip_item.update({
                where: { pharmacy_slip_item_id: item.pharmacy_slip_item_id },
                data: patch
            });
            changes[`item:${item.pharmacy_slip_item_id}`] = {
                quantity: patch.quantity !== undefined ? patch.quantity : prev.quantity,
                dose: patch.dose !== undefined ? patch.dose : prev.dose,
                dose_unit: patch.dose_unit !== undefined ? patch.dose_unit : prev.dose_unit,
                brand_name: patch.brand_name !== undefined ? patch.brand_name : prev.brand_name,
                drug_name: prev.drug_name,
                drug_role: patch.drug_role !== undefined ? patch.drug_role : prev.drug_role
            };
        }
        if (newItemsDto.length > 0) {
            const newItemIds = await this.repository.generateSlipItemIds(tx, newItemsDto.length);
            const startIndex = existingItemsDto.length;
            for (let i = 0; i < newItemsDto.length; i++) {
                const item = newItemsDto[i];
                const generatedId = newItemIds[i];
                const resolvedPharmItemId = await this.resolveOrCreatePharmacyMasterItem(tx, item, slip.branch_id);
                await tx.pharmacy_slip_item.create({
                    data: {
                        pharmacy_slip_item_id: generatedId,
                        pharmacy_slip_id: slip.pharmacy_slip_id,
                        display_order: startIndex + i,
                        medicine_id: clean(item.medicine_id),
                        drug_name: (0, caseFormatters_1.toProperCase)(clean(item.drug_name)),
                        brand_name: (0, caseFormatters_1.toProperCase)(clean(item.brand_name)),
                        dose: clean(item.dose),
                        dose_unit: clean(item.dose_unit),
                        quantity: item.quantity ?? null,
                        drug_role: clean(item.drug_role) ?? pharmacy_constants_1.PHARMACY_DRUG_ROLE.PRIMARY,
                        route: clean(item.route),
                        frequency: clean(item.frequency),
                        duration: clean(item.duration),
                        instructions: clean(item.instructions),
                        pharmacy_item_id: resolvedPharmItemId || clean(item.pharmacy_item_id)
                    }
                });
                changes[`item:${generatedId}:created`] = {
                    drug_name: item.drug_name,
                    brand_name: item.brand_name,
                    dose: item.dose,
                    dose_unit: item.dose_unit,
                    quantity: item.quantity
                };
            }
        }
        if (opts.allowDelete) {
            // Omitted lines are the ones the user deleted in the UI.
            await this.repository.deleteSlipItems(tx, slip.pharmacy_slip_id, existingIds);
        }
        return { changes, before };
    }
    async updateItems(pharmacySlipId, dto, actingUserId) {
        return prisma_1.default.$transaction(async (tx) => {
            const existing = await this.requireSlip(tx, pharmacySlipId);
            if (!pharmacy_constants_1.PHARMACY_SLIP_EDITABLE_STATUSES.includes(existing.slip_status)) {
                throw new Error("This pharmacy slip can no longer be edited because it is cancelled. Create a new slip instead.");
            }
            const { before, changes } = await this.applyItemChanges(tx, existing, dto.items, { allowAdd: true, allowDelete: true });
            await (0, audit_service_1.logAudit)(tx, {
                entity_type: AUDIT_ENTITY,
                entity_id: pharmacySlipId,
                action: "UPDATE",
                performed_by: actingUserId,
                patient_id: existing.patient_id,
                branch_id: existing.branch_id,
                change_summary: (0, audit_service_1.diffFields)(before, changes)
            });
            return pharmacySlipId;
        }, { timeout: 30000 }).then(() => this.getSlip(pharmacySlipId));
    }
    async amend(pharmacySlipId, dto, actingUserId) {
        const reason = clean(dto.reason);
        if (!reason) {
            throw new Error("An amendment reason is required");
        }
        return prisma_1.default.$transaction(async (tx) => {
            const existing = await this.requireSlip(tx, pharmacySlipId);
            if (!pharmacy_constants_1.PHARMACY_SLIP_AMENDABLE_STATUSES.includes(existing.slip_status)) {
                if (existing.slip_status === pharmacy_constants_1.PHARMACY_SLIP_STATUS.DRAFT) {
                    throw new Error("Draft slips can be edited directly without an amendment reason.");
                }
                throw new Error("A cancelled pharmacy slip cannot be amended.");
            }
            const { before, changes } = await this.applyItemChanges(tx, existing, dto.items, { allowAdd: false, allowDelete: false });
            const now = new Date();
            await this.repository.updateSlip(tx, pharmacySlipId, {
                amend_count: { increment: 1 },
                last_amended_at: now,
                last_amended_by: actingUserId,
                last_amend_reason: reason,
                updated_by: actingUserId,
                updated_at: now
            });
            const diffStr = (0, audit_service_1.diffFields)(before, changes);
            let fieldsDiff = {};
            try {
                fieldsDiff = JSON.parse(diffStr);
            }
            catch {
                fieldsDiff = diffStr;
            }
            await (0, audit_service_1.logAudit)(tx, {
                entity_type: AUDIT_ENTITY,
                entity_id: pharmacySlipId,
                action: audit_types_1.AUDIT_ACTION.AMEND,
                performed_by: actingUserId,
                patient_id: existing.patient_id,
                branch_id: existing.branch_id,
                change_summary: JSON.stringify({ reason, fields: fieldsDiff })
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
    async issue(pharmacySlipId, dto, actingUserId) {
        return prisma_1.default.$transaction(async (tx) => {
            const existing = await this.requireSlip(tx, pharmacySlipId);
            this.assertTransition(existing.slip_status, pharmacy_constants_1.PHARMACY_SLIP_STATUS.ISSUED);
            const remaining = await tx.pharmacy_slip_item.count({
                where: { pharmacy_slip_id: pharmacySlipId }
            });
            if (remaining === 0) {
                throw new Error("This pharmacy slip has no medicine lines to issue");
            }
            const now = new Date();
            await this.repository.updateSlip(tx, pharmacySlipId, {
                slip_status: pharmacy_constants_1.PHARMACY_SLIP_STATUS.ISSUED,
                issued_at: now,
                issued_by: actingUserId,
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
                change_summary: (0, audit_service_1.summarizeStatusChange)(existing.slip_status, pharmacy_constants_1.PHARMACY_SLIP_STATUS.ISSUED, dto.note ?? null)
            });
            return pharmacySlipId;
        }, { timeout: 30000 }).then(() => this.getSlip(pharmacySlipId));
    }
    /*
     * Printing is a pure document action: it restamps printed_at and records
     * the print in the audit log, but never alters the slip's status. Reprints
     * are unlimited.
     */
    async markPrinted(pharmacySlipId, dto, actingUserId) {
        return prisma_1.default.$transaction(async (tx) => {
            const existing = await this.requireSlip(tx, pharmacySlipId);
            if (existing.slip_status === pharmacy_constants_1.PHARMACY_SLIP_STATUS.CANCELLED) {
                throw new Error("A cancelled pharmacy slip cannot be printed");
            }
            const remaining = await tx.pharmacy_slip_item.count({
                where: { pharmacy_slip_id: pharmacySlipId }
            });
            if (remaining === 0) {
                throw new Error("This pharmacy slip has no medicine lines to print");
            }
            const printedBy = clean(dto.printed_by) ?? actingUserId;
            const now = new Date();
            const isFirstPrint = existing.printed_at === null;
            await this.repository.updateSlip(tx, pharmacySlipId, {
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
                change_summary: isFirstPrint ? "printed" : "printed (reprint)"
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
            medicine_name: (0, caseFormatters_1.toProperCase)(dto.medicine_name.trim()),
            generic_name: dto.generic_name?.trim() ? (0, caseFormatters_1.toProperCase)(dto.generic_name.trim()) : null,
            dosage_form: dto.dosage_form?.trim() || null
        });
        return med;
    }
}
exports.PharmacyService = PharmacyService;
