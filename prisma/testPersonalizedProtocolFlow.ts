import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ChemotherapyService } from "../src/modules/chemotherapy/chemotherapy.service";
import { generateId } from "../src/utils/idGenerator";

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const service = new ChemotherapyService();

const ORG_A = "HSP001";
const ORG_B = "HSP002";
const ACTOR = "E2E_TEST_USER";
const PLAN_ACTOR = "USR117";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: unknown) {
    if (condition) {
        passed++;
        console.log(`  PASS: ${label}`);
    } else {
        failed++;
        console.error(`  FAIL: ${label}`, detail ?? "");
    }
}

async function expectError(label: string, fn: () => Promise<unknown>, messagePart?: string) {
    try {
        await fn();
        failed++;
        console.error(`  FAIL: ${label} - expected an error but none was thrown`);
    } catch (error: any) {
        const ok = !messagePart || String(error.message).includes(messagePart);
        if (ok) {
            passed++;
            console.log(`  PASS: ${label} (rejected: ${error.message})`);
        } else {
            failed++;
            console.error(`  FAIL: ${label} - threw '${error.message}', expected to contain '${messagePart}'`);
        }
    }
}

async function seedRichGeneric(): Promise<{ protocolId: string; regimenCode: string }> {

    const regimenCode = `E2E-GEN-${Date.now().toString(36)}`;

    return prisma.$transaction(async (tx) => {

        const protocolId = await generateId(tx, "REGIMEN_PROTOCOL");

        await tx.chemotherapy_regimen_protocol.create({
            data: {
                protocol_id: protocolId,
                regimen_code: regimenCode,
                regimen_name: "E2E Test Generic Protocol",
                protocol_type: "GENERIC",
                organization_id: null,
                protocol_version: "v1",
                active_status: 1,
                cancer_type_id: "CT003",
                subtype_id: "CST007",
                treatment_intent: "Palliative/Targeted",
                standard_cycles: 4,
                cycle_interval_days: 21,
                guideline_source: "E2E test seed",
                no_of_days: 2,
                notes: "Seeded by the personalized-protocol E2E test"
            }
        });

        const day1Id = await generateId(tx, "REGIMEN_PROTOCOL_DAY");
        await tx.chemotherapy_regimen_protocol_days.create({
            data: {
                protocol_day_id: day1Id,
                protocol_id: protocolId,
                day_number: 1,
                day_sequence: 1,
                same_as_day_one: false,
                active_status: 1,
                created_by: ACTOR
            }
        });

        const day2Id = await generateId(tx, "REGIMEN_PROTOCOL_DAY");
        await tx.chemotherapy_regimen_protocol_days.create({
            data: {
                protocol_day_id: day2Id,
                protocol_id: protocolId,
                day_number: 2,
                day_sequence: 2,
                same_as_day_one: false,
                active_status: 1,
                created_by: ACTOR
            }
        });

        const item1Id = await generateId(tx, "REGIMEN_PROTOCOL_ITEM");
        await tx.chemotherapy_regimen_protocol_items.create({
            data: {
                protocol_item_id: item1Id,
                protocol_id: protocolId,
                medicine_id: "MED000028",
                drug_role: "PRIMARY",
                drug_sequence: 1,
                dosage: 6,
                dosage_unit: "mg/kg",
                administration_route: "IV",
                administration_day: 1,
                frequency: "Day 1 of cycle",
                active_status: 1
            }
        });

        const dilutionId = await generateId(tx, "REGIMEN_PROTOCOL_DILUTION");
        await tx.chemotherapy_protocol_dilutions.create({
            data: {
                protocol_dilution_id: dilutionId,
                protocol_id: protocolId,
                protocol_item_id: item1Id,
                medicine_id: "MED000006",
                form: "IV bag",
                dose: 250,
                dose_unit: "mg",
                dilution_volume: 250,
                dilution_volume_unit: "mL",
                diluent: "Normal Saline",
                comment: "Infuse over 60 minutes",
                active_status: 1,
                created_by: ACTOR
            }
        });

        const item2Id = await generateId(tx, "REGIMEN_PROTOCOL_ITEM");
        await tx.chemotherapy_regimen_protocol_items.create({
            data: {
                protocol_item_id: item2Id,
                protocol_id: protocolId,
                medicine_id: "MED000034",
                drug_role: "PRIMARY",
                drug_sequence: 2,
                dosage: 75,
                dosage_unit: "mg/m2",
                administration_route: "IV",
                administration_day: 2,
                frequency: "Day 1 of cycle",
                active_status: 1
            }
        });

        const item3Id = await generateId(tx, "REGIMEN_PROTOCOL_ITEM");
        await tx.chemotherapy_regimen_protocol_items.create({
            data: {
                protocol_item_id: item3Id,
                protocol_id: protocolId,
                medicine_id: "MED000048",
                drug_role: "PREMEDICATION",
                drug_sequence: 90,
                dosage: 8,
                dosage_unit: "mg",
                administration_route: "IV",
                administration_day: 1,
                active_status: 1
            }
        });

        return { protocolId, regimenCode };

    }, { timeout: 30000 });

}

async function ensureOrgB() {

    const existing = await prisma.hospital.findUnique({ where: { hospital_id: ORG_B } });

    if (!existing) {
        await prisma.hospital.create({
            data: {
                hospital_id: ORG_B,
                hospital_name: "E2E Test Organization B",
                Hospital_address: "Test address"
            }
        });
        console.log(`[setup] created org B hospital ${ORG_B}`);
    } else {
        console.log(`[setup] org B hospital ${ORG_B} already exists`);
    }

}

async function simulateClinicalUse(protocolId: string) {

    const planId = `PLN-E2E-${Date.now()}`;

    await prisma.chemotherapy_plan.create({
        data: {
            chemotherapy_plan_id: planId,
            patient_history_id: "PHX003",
            patient_id: "PAT005",
            diagnosis_id: "DIS000001",
            employee_id: "DOC004",
            department_id: "DEP002",
            branch_id: "BRA015",
            regimen_name: "E2E clinical use",
            planned_cycles: 4,
            treatment_start_date: new Date(),
            source_protocol_id: protocolId,
            deleted_flag: false
        }
    });

    return planId;

}

const VALID_PLAN_DTO = {
    patient_id: "PAT005",
    staging_detail_id: "STD002",
    diagnosis_id: "DIS000001",
    employee_id: "DOC004",
    department_id: "DEP002",
    branch_id: "BRA015",
    regimen_name: "E2E plan",
    planned_cycles: 2,
    treatment_start_date: new Date().toISOString(),
    confirm_suggested_therapy: true
};

async function main() {

    console.log("\n=== E2E: Organization-Specific Personalized Chemotherapy Regimen Protocol Workflow ===\n");

    await ensureOrgB();

    // -------------------------------------------------------------
    console.log("\n[1] Seed a rich GENERIC source protocol (2 days, 3 items, 1 dilution)");
    const { protocolId: genericId, regimenCode: genericCode } = await seedRichGeneric();
    console.log(`  seeded generic protocol ${genericId}`);
    const source = await service.getRegimenProtocol(genericId);
    assert(!!source, "generic source fetchable", source);
    assert(source.protocol_type === "GENERIC", "source is GENERIC");
    assert((source.chemotherapy_regimen_protocol_items ?? []).length === 3, "source has 3 items");
    const sourceDayCount = await prisma.chemotherapy_regimen_protocol_days.count({ where: { protocol_id: genericId, active_status: 1 } });
    assert(sourceDayCount === 2, "source has 2 days");

    // -------------------------------------------------------------
    console.log("\n[2] Personalize the generic for org A (full clone, no custom payload)");
    const personalized = await service.personalizeProtocol(genericId, ORG_A, ACTOR, {
        regimen_name: "Org A E2E Regimen v1"
    });

    const pid = personalized.protocol.protocol_id;
    assert(personalized.protocol.protocol_type === "PERSONALIZED", "clone is PERSONALIZED");
    assert(personalized.protocol.organization_id === ORG_A, "clone owned by org A");
    assert(personalized.protocol.regimen_code !== source.regimen_code, "clone has a derived (unique) regimen_code");
    assert(String(personalized.protocol.regimen_code).startsWith(`${source.regimen_code}-${ORG_A}-`), `derived code format (${personalized.protocol.regimen_code})`);
    assert(personalized.protocol.protocol_reference === genericId, "protocol_reference points at the generic source");
    assert(personalized.protocol.original_protocol === genericId, "original_protocol points at the generic root");
    assert(personalized.protocol.protocol_version === "v1", "clone starts at v1");
    assert(personalized.protocol.active_status === 0, "clone starts as an INACTIVE draft");
    assert(personalized.days.length === 2, "clone inherited 2 days");
    const day1Id = personalized.days.find((d: any) => d.day_number === 1)?.protocol_day_id;
    assert(!!day1Id, "day 1 has a fresh cloned id");
    const clonedItems = personalized.days.flatMap((d: any) => d.items ?? []);
    assert(clonedItems.length === 3, `clone inherited 3 items on days (${clonedItems.length})`);
    assert(personalized.days.find((d: any) => d.day_number === 2)?.items.length === 1, "day 2 kept its item");
    const clonedDilutions = clonedItems.flatMap((i: any) => i.dilutions ?? []);
    assert(clonedDilutions.length === 1, "clone inherited the dilution");
    assert(clonedDilutions[0]?.diluent === "Normal Saline", "clone dilution values intact");
    assert(personalized.unassigned_items.length === 0, "no unassigned items");
    assert(personalized.days.some((d: any) => d.items?.some((i: any) => i.inherited_from != null)), "inherited_from metadata present");
    assert(personalized.status === "DRAFT", "editor payload status is DRAFT");
    assert(personalized.clinically_used === false, "not clinically used");
    assert(personalized.source_protocol?.protocol_id === genericId, "source_protocol metadata points at generic root");

    // -------------------------------------------------------------
    console.log("\n[3] Org isolation (org B must not see org A's clone)");
    await expectError("org B cannot GET org A's clone", () => service.getPersonalizedProtocol(pid, ORG_B), "not found");
    await expectError("org B cannot mutate org A's clone", () => service.updatePersonalizedProtocol(pid, ORG_B, ACTOR, { regimen_name: "Hijack" }), "not found");
    const orgBList = await service.listPersonalizedProtocols(ORG_B);
    assert(!orgBList.some((p: any) => p.protocol.protocol_id === pid), "org B's personalized list excludes org A's clone");

    // -------------------------------------------------------------
    console.log("\n[4] Generic list excludes PERSONALIZED clones; org-scoped list is active-only");
    const genericList = await service.listRegimenProtocols({});
    assert(!genericList.some((p: any) => p.protocol_id === pid), "clone hidden from the global generic list");
    const orgScopedList = await service.listRegimenProtocols({ organization_id: ORG_A });
    assert(!orgScopedList.some((p: any) => p.protocol_id === pid), "inactive draft clone hidden from org A's scoped (selectable) list");
    const orgBScopedList = await service.listRegimenProtocols({ organization_id: ORG_B });
    assert(!orgBScopedList.some((p: any) => p.protocol_id === pid), "clone hidden from org B's scoped list");

    // -------------------------------------------------------------
    console.log("\n[5] Generic-protocol mutations are rejected on PERSONALIZED clones");
    await expectError("updateRegimenProtocol rejects the clone", () => service.updateRegimenProtocol(pid, { standard_cycles: 99 }, ACTOR), "must be edited through the personalized protocol endpoints");
    await expectError("addRegimenProtocolItem rejects the clone", () => service.addRegimenProtocolItem(pid, { medicine_id: "MED000001", drug_sequence: 5, drug_role: "PRIMARY" }, ACTOR), "must be edited through the personalized protocol endpoints");
    await expectError("removeRegimenProtocolItem rejects the clone", () => service.removeRegimenProtocolItem(pid, "RPI001", ACTOR), "must be edited through the personalized protocol endpoints");

    // -------------------------------------------------------------
    console.log("\n[6] Draft editing: update protocol header + items + dilutions + days");
    const updated = await service.updatePersonalizedProtocol(pid, ORG_A, ACTOR, {
        regimen_name: "Org A E2E Regimen v1 (revised)",
        standard_cycles: 6,
        additional_notes: "Reduced infusion-related toxicity observed"
    });
    assert(updated.protocol.regimen_name === "Org A E2E Regimen v1 (revised)", "header updated");
    assert(updated.protocol.standard_cycles === 6, "standard_cycles updated");
    assert(updated.protocol.protocol_version === "v1", "same version retained while still a draft");

    const firstItem = updated.days.flatMap((d: any) => d.items ?? [])[0];
    const itemRes = await service.updatePersonalizedProtocolItem(pid, firstItem.protocol_item_id, ORG_A, ACTOR, {
        dosage: 5.5,
        remarks: "Dose reduced per renal function"
    });
    assert(itemRes.days.flatMap((d: any) => d.items ?? []).some((i: any) => i.protocol_item_id === firstItem.protocol_item_id && Number(i.dosage) === 5.5), "item dosage updated");
    assert(itemRes.days.flatMap((d: any) => d.items ?? []).some((i: any) => i.protocol_item_id === firstItem.protocol_item_id && i.is_modified === true), "modified item flagged is_modified");

    const addedItem = await service.addPersonalizedProtocolItem(pid, ORG_A, ACTOR, {
        medicine_id: "MED000032",
        drug_role: "PRIMARY",
        drug_sequence: 3,
        dosage: 600,
        dosage_unit: "mg/m2",
        administration_route: "IV",
        administration_day: 2
    });
    const allItemsAfterAdd = addedItem.days.flatMap((d: any) => d.items ?? []);
    assert(allItemsAfterAdd.length === 4, `new item added (${allItemsAfterAdd.length} items total)`);
    assert(addedItem.days.find((d: any) => d.day_number === 2)?.items?.some((i: any) => i.medicine_id === "MED000032") === true, "new item placed on day 2");

    const dilutionTarget = addedItem.days.flatMap((d: any) => d.items ?? []).find((i: any) => i.dilutions?.length > 0);
    assert(!!dilutionTarget, "dilution target item resolved");
    const dilutionUpdated = await service.updatePersonalizedProtocolDilution(pid, dilutionTarget!.protocol_item_id, dilutionTarget!.dilutions[0].protocol_dilution_id, ORG_A, ACTOR, {
        dilution_volume: 500,
        diluent: "5% Dextrose"
    });
    assert(dilutionUpdated.days.flatMap((d: any) => d.items ?? []).flatMap((i: any) => i.dilutions ?? []).some((x: any) => x.diluent === "5% Dextrose"), "dilution updated");

    const dayTwoId = updated.days.find((d: any) => d.day_number === 2)?.protocol_day_id;
    assert(!!dayTwoId, "day 2 id resolved");
    await service.updatePersonalizedProtocolDay(pid, dayTwoId!, ORG_A, ACTOR, {
        same_as_day_one: true
    });

    const addedDay = await service.addPersonalizedProtocolDay(pid, ORG_A, ACTOR, {
        day_number: 3,
        day_sequence: 3
    });
    assert(addedDay.days.length === 3, "day 3 added");

    // -------------------------------------------------------------
    console.log("\n[7] Invalid structure rolls back atomically (child-validation)");
    await expectError("addPersonalizedProtocolDay with duplicate day_number rejected", () =>
        service.addPersonalizedProtocolDay(pid, ORG_A, ACTOR, { day_number: 1 }), "Duplicate day_number");
    const afterFailed = await service.getPersonalizedProtocol(pid, ORG_A);
    assert(afterFailed.days.length === 3, "no partial state after failed add-day (atomic rollback)");
    assert(afterFailed.days.find((d: any) => d.day_number === 1)?.protocol_day_id === day1Id, "day 1 untouched");

    // -------------------------------------------------------------
    console.log("\n[8] Remove operations");
    const removedDay = await service.removePersonalizedProtocolDay(pid, dayTwoId!, ORG_A, ACTOR);
    assert(removedDay.days.length === 2, "day 2 removed");
    const orphanedItem = removedDay.unassigned_items.find((i: any) => i.medicine_id === "MED000032");
    assert(!!orphanedItem, "item of removed day moves to unassigned_items");
    const removedItem = await service.removePersonalizedProtocolItem(pid, orphanedItem!.protocol_item_id, ORG_A, ACTOR);
    assert(removedItem.days.flatMap((d: any) => d.items ?? []).length + removedItem.unassigned_items.length === 3, "removed item gone (3 remain)");

    // -------------------------------------------------------------
    console.log("\n[9] Activation");
    await expectError("org B cannot activate org A's clone", () => service.activatePersonalizedProtocol(pid, ORG_B, ACTOR), "not found");
    const activated = await service.activatePersonalizedProtocol(pid, ORG_A, ACTOR);
    assert(activated.status === "ACTIVE", "clone activated");
    const activatedGet = await service.getPersonalizedProtocol(pid, ORG_A);
    assert(activatedGet.clinically_used === false, "not yet clinically used");
    const orgScopedAfterActivation = await service.listRegimenProtocols({ organization_id: ORG_A });
    assert(orgScopedAfterActivation.some((p: any) => p.protocol_id === pid), "active clone now visible in org A's scoped (selectable) list");

    // -------------------------------------------------------------
    console.log("\n[10] Clinical use blocks edits -> versioning is required");
    const planId = await simulateClinicalUse(pid);
    console.log(`  simulated clinical use via plan ${planId}`);
    const usedGet = await service.getPersonalizedProtocol(pid, ORG_A);
    assert(usedGet.clinically_used === true, "clinically_used flag now true");
    await expectError("updatePersonalizedProtocol blocked once clinically used", () =>
        service.updatePersonalizedProtocol(pid, ORG_A, ACTOR, { regimen_name: "Too late" }), "create a new version");
    await expectError("addPersonalizedProtocolItem blocked once clinically used", () =>
        service.addPersonalizedProtocolItem(pid, ORG_A, ACTOR, { medicine_id: "MED000001", drug_sequence: 99 }), "create a new version");
    await expectError("removePersonalizedProtocolDay blocked once clinically used", () =>
        service.removePersonalizedProtocolDay(pid, day1Id!, ORG_A, ACTOR), "create a new version");

    const v2 = await service.createPersonalizedProtocolVersion(pid, ORG_A, ACTOR, {
        reason: "Patient developed neutropenia; regimen requires a dose schedule change"
    });
    assert(v2.protocol.protocol_version === "v2", "new version is v2");
    assert(v2.protocol.protocol_id !== pid, "new version has a fresh protocol_id");
    assert(v2.protocol.protocol_reference === pid, "v2 references v1 as its parent");
    assert(v2.protocol.original_protocol === genericId, "v2 keeps the original generic root");
    assert(v2.status === "DRAFT", "v2 starts as a draft");
    assert(v2.days.length === 2, "v2 cloned the current structure (2 days)");
    assert(v2.days.flatMap((d: any) => d.items ?? []).length === 2, "v2 cloned remaining items");

    const v1After = await service.getPersonalizedProtocol(pid, ORG_A);
    assert(v1After.status === "DRAFT", "v1 auto-deactivated when versioned");
    assert(String(v1After.protocol.notes ?? "").toLowerCase().includes("superseded"), "v1 notes mark it superseded");

    const v2List = await service.listPersonalizedProtocols(ORG_A);
    assert(v2List.some((p: any) => p.protocol.protocol_id === v2.protocol.protocol_id), "v2 appears in org A list");
    assert(v2List.some((p: any) => p.protocol.protocol_id === pid), "v1 (inactive) still listed for history");

    // -------------------------------------------------------------
    console.log("\n[11] Only active, org-owned personalized protocols can back a plan");
    await expectError("inactive v2 cannot be selected for a plan", () =>
        service.createPlan({ ...VALID_PLAN_DTO, protocol_id: v2.protocol.protocol_id } as any, PLAN_ACTOR, ORG_A), "not active");

    await service.activatePersonalizedProtocol(v2.protocol.protocol_id, ORG_A, ACTOR);
    await expectError("org B cannot use org A's active clone for a plan", () =>
        service.createPlan({ ...VALID_PLAN_DTO, protocol_id: v2.protocol.protocol_id } as any, PLAN_ACTOR, ORG_B), "does not belong to your organization");
    const validPlan = await service.createPlan({ ...VALID_PLAN_DTO, protocol_id: v2.protocol.protocol_id } as any, PLAN_ACTOR, ORG_A);
    assert(!!validPlan, "org A CAN create a plan with its own active clone");

    // -------------------------------------------------------------
    console.log("\n[12] Generic source remains untouched by all of the above");
    const sourceAfter = await service.getRegimenProtocol(genericId);
    assert(sourceAfter.regimen_name === "E2E Test Generic Protocol", "generic header unchanged");
    assert((sourceAfter.chemotherapy_regimen_protocol_items ?? []).length === 3, "generic items unchanged");
    assert(sourceAfter.organization_id === null, "generic stays global (no org)");
    const sourceDayCountAfter = await prisma.chemotherapy_regimen_protocol_days.count({ where: { protocol_id: genericId, active_status: 1 } });
    assert(sourceDayCountAfter === 2, "generic days unchanged");

    console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===\n`);
    console.log("Sample data left in place for Postman testing:");
    console.log(`  org A = ${ORG_A}, org B = ${ORG_B}`);
    console.log(`  generic source      = ${genericId}`);
    console.log(`  personalized v1     = ${pid} (superseded/inactive, clinically used)`);
    console.log(`  personalized v2     = ${v2.protocol.protocol_id} (active, clinically used)`);
    console.log(`  clinical-use plan   = ${planId}`);

    process.exitCode = failed > 0 ? 1 : 0;

}

main()
    .catch((e) => { console.error("E2E crashed:", e); process.exitCode = 1; })
    .finally(async () => { await prisma.$disconnect(); });