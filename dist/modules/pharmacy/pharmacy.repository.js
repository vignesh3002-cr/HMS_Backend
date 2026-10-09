"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PharmacyRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const idGenerator_1 = require("../../utils/idGenerator");
const chemotherapy_constants_1 = require("../chemotherapy/chemotherapy.constants");
const pharmacy_constants_1 = require("./pharmacy.constants");
const slipDetailInclude = {
    patient_bio_data: {
        select: { patient_id: true, patient_first_name: true, patient_last_name: true }
    },
    pharmacy_slip_item: {
        orderBy: { display_order: "asc" }
    }
};
const startOfDay = (value) => {
    const date = typeof value === "string" ? new Date(`${value}T00:00:00.000Z`) : value;
    return date;
};
const startOfNextDay = (value) => {
    const date = typeof value === "string" ? new Date(`${value}T00:00:00.000Z`) : value;
    return new Date(date.getTime() + 24 * 60 * 60 * 1000);
};
const normaliseDate = (value) => {
    if (!value)
        return null;
    const date = typeof value === "string" ? new Date(`${value}T00:00:00.000Z`) : value;
    return Number.isNaN(date.getTime()) ? null : date;
};
class PharmacyRepository {
    // ---------------------------------------------------------------
    // Slips
    // ---------------------------------------------------------------
    async findSlipById(pharmacySlipId) {
        return prisma_1.default.pharmacy_slip.findUnique({
            where: { pharmacy_slip_id: pharmacySlipId },
            include: slipDetailInclude
        });
    }
    async findLiveSlipForOrder(planOrderId) {
        return prisma_1.default.pharmacy_slip.findFirst({
            where: {
                plan_order_id: planOrderId,
                slip_status: { not: pharmacy_constants_1.PHARMACY_SLIP_STATUS.CANCELLED }
            },
            include: slipDetailInclude
        });
    }
    async listSlips(query) {
        const { branch_id, patient_id, encounter_no, appointment_id, cycle_number, plan_id, status, search, date_from, date_to, page = 1, limit = 20 } = query;
        const where = {};
        if (branch_id)
            where.branch_id = branch_id;
        if (patient_id)
            where.patient_id = patient_id;
        if (encounter_no)
            where.encounter_no = encounter_no;
        if (appointment_id)
            where.appointment_id = appointment_id;
        if (cycle_number)
            where.cycle_number = cycle_number;
        if (status)
            where.slip_status = status;
        // A slip is stamped with the cycle-day order it came from, so "every
        // slip for this plan" means matching any of the plan's orders.
        if (plan_id) {
            const orders = await prisma_1.default.chemotherapy_plan_order.findMany({
                where: { chemotherapy_plan_id: plan_id },
                select: { plan_order_id: true }
            });
            where.plan_order_id = { in: orders.map((order) => order.plan_order_id) };
        }
        if (search) {
            where.OR = [
                { pharmacy_slip_id: { contains: search } },
                { protocol_name: { contains: search } },
                { regimen_name: { contains: search } },
                {
                    pharmacy_slip_item: {
                        some: { drug_name: { contains: search } }
                    }
                }
            ];
        }
        if (date_from || date_to) {
            where.created_at = {
                ...(date_from ? { gte: startOfDay(date_from) } : {}),
                ...(date_to ? { lt: startOfNextDay(date_to) } : {})
            };
        }
        const skip = Math.max(0, (page - 1) * limit);
        const [rows, total] = await Promise.all([
            prisma_1.default.pharmacy_slip.findMany({
                where,
                include: slipDetailInclude,
                orderBy: { created_at: "desc" },
                skip,
                take: limit
            }),
            prisma_1.default.pharmacy_slip.count({ where })
        ]);
        return { rows, total, page, limit, total_pages: Math.max(1, Math.ceil(total / limit)) };
    }
    async generateSlipId(tx) {
        const [id] = await (0, idGenerator_1.generateIdBatch)(tx, pharmacy_constants_1.ID_ENTITY.SLIP, 1);
        return id;
    }
    async createSlip(tx, data) {
        return tx.pharmacy_slip.create({ data });
    }
    async updateSlip(tx, pharmacySlipId, data) {
        return tx.pharmacy_slip.update({
            where: { pharmacy_slip_id: pharmacySlipId },
            data
        });
    }
    // ---------------------------------------------------------------
    // Slip items
    // ---------------------------------------------------------------
    async findSlipItem(pharmacySlipItemId) {
        return prisma_1.default.pharmacy_slip_item.findUnique({
            where: { pharmacy_slip_item_id: pharmacySlipItemId }
        });
    }
    async generateSlipItemIds(tx, count) {
        return (0, idGenerator_1.generateIdBatch)(tx, pharmacy_constants_1.ID_ENTITY.SLIP_ITEM, count);
    }
    // createMany in one round trip: the item ids come from a single sequence
    // lock (same reasoning as prescription.repository.ts) so a multi-medicine
    // slip does not pay one lock + collision-check per row.
    async createSlipItems(tx, rows) {
        if (rows.length === 0)
            return;
        await tx.pharmacy_slip_item.createMany({ data: rows });
    }
    // Removes the lines the caller did not send, so the UI's delete button
    // persists by omission rather than needing its own tombstone column.
    async deleteSlipItems(tx, pharmacySlipId, keepIds) {
        await tx.pharmacy_slip_item.deleteMany({
            where: {
                pharmacy_slip_id: pharmacySlipId,
                ...(keepIds.length > 0 ? { pharmacy_slip_item_id: { notIn: keepIds } } : {})
            }
        });
    }
    // ---------------------------------------------------------------
    // Source readers
    //
    // Read-only. The pharmacy module must never mutate chemotherapy or
    // prescription state - it only copies from it.
    // ---------------------------------------------------------------
    /*
     * Everything a slip needs from one plan: the plan header
     * (patient, visit, branch, protocol), its baseline items (plan_order_id
     * null), every saved cycle-day order header, and the chosen current
     * order's items with their medicine_master rows.
     */
    async findPlanForPharmacy(planId) {
        const plan = await prisma_1.default.chemotherapy_plan.findUnique({
            where: { chemotherapy_plan_id: planId },
            include: {
                patient_bio_data: {
                    select: { patient_id: true, patient_first_name: true, patient_last_name: true }
                },
                chemotherapy_regimen_protocol: {
                    include: {
                        chemotherapy_discharge_instructions: {
                            where: { active_status: 1 },
                            include: { medicine_master: true },
                            orderBy: { drug_sequence: "asc" }
                        }
                    }
                },
                chemotherapy_plan_items: {
                    where: { active_status: 1, plan_order_id: null },
                    include: { medicine_master: true },
                    orderBy: { drug_sequence: "asc" }
                }
            }
        });
        if (!plan)
            return null;
        const orderHeaders = await prisma_1.default.chemotherapy_plan_order.findMany({
            where: { chemotherapy_plan_id: planId },
            include: { chemotherapy_cycle: { select: { cycle_status: true } } },
            orderBy: [{ cycle_number: "asc" }, { cycle_day: "asc" }]
        });
        const currentHeader = this.pickCurrentOrderHeader(plan.treatment_status, orderHeaders);
        const currentOrder = currentHeader
            ? await prisma_1.default.chemotherapy_plan_order.findUnique({
                where: { plan_order_id: currentHeader.plan_order_id },
                include: {
                    chemotherapy_plan_items: {
                        where: { active_status: 1 },
                        include: { medicine_master: true },
                        orderBy: { drug_sequence: "asc" }
                    }
                }
            })
            : null;
        return { plan, orderHeaders, currentHeader, currentOrder };
    }
    /*
     * Mirrors pickCurrentOrder in chemotherapy.service.ts, reusing that
     * module's own constants so the two cannot drift: on an open plan the
     * first still-ORDERED day whose cycle is not terminal, else - and always
     * on a closed plan - the latest COMPLETED one.
     */
    pickCurrentOrderHeader(planStatus, orders) {
        const planOpen = !chemotherapy_constants_1.PLAN_TERMINAL_STATUSES.includes(planStatus);
        const pending = planOpen
            ? orders.find((order) => order.order_status === chemotherapy_constants_1.PLAN_ORDER_STATUS.ORDERED
                && !chemotherapy_constants_1.CYCLE_TERMINAL_STATUSES.includes(order.chemotherapy_cycle?.cycle_status))
            : undefined;
        return pending
            ?? [...orders].reverse().find((order) => order.order_status === chemotherapy_constants_1.PLAN_ORDER_STATUS.COMPLETED)
            ?? null;
    }
    /*
     * The visit a plan order belongs to. A chemotherapy course spans many
     * appointments, so the plan header keeps pointing at the visit that
     * started it while each cycle-day order is saved against the encounter
     * actually being administered. Reading the encounter gives the pharmacy
     * slip the appointment and branch of the current visit rather than the
     * historical ones on the plan header.
     */
    async findVisitForEncounter(encounterNo) {
        if (!encounterNo)
            return null;
        return prisma_1.default.encounter.findUnique({
            where: { encounter_no: encounterNo },
            select: {
                encounter_no: true,
                patient_id: true,
                appointment_id: true,
                branch_id: true,
                employee_id: true
            }
        });
    }
    /*
     * The visit's advice prescription - the separate Rx the consultation
     * writes alongside the chemo order, stamped drug_role='ADVICE' by
     * AdviceSection.tsx so it can be told apart from the chemo prescription.
     * Same lookup that component performs client-side: newest non-cancelled
     * prescription for the appointment that has at least one ADVICE line.
     */
    async findAdvicePrescription(appointmentId, patientId) {
        if (!appointmentId)
            return null;
        const prescription = await prisma_1.default.prescription.findFirst({
            where: {
                prescription_status: { not: "CANCELLED" },
                patient_history: { appointment_id: appointmentId },
                prescription_items: { some: { drug_role: "ADVICE" } }
            },
            include: {
                prescription_items: {
                    include: { medicine_master: true },
                    orderBy: { prescription_item_id: "asc" }
                }
            },
            orderBy: { created_at: "desc" }
        });
        if (!prescription)
            return null;
        // patient_history.appointment_id is the filter above; this guards the
        // (possible) case of a patient_history row whose patient disagrees
        // with the plan, so a slip can never mix two patients' medicines.
        const history = await prisma_1.default.patient_history.findUnique({
            where: { patient_history_id: prescription.patient_history_id ?? "" },
            select: { patient_id: true }
        });
        if (history?.patient_id && history.patient_id !== patientId)
            return null;
        return prescription;
    }
    async findPrescriptionForPharmacy(prescriptionId) {
        return prisma_1.default.prescription.findUnique({
            where: { prescription_id: prescriptionId },
            include: {
                patient_history: {
                    include: {
                        patient_bio_data: {
                            select: { patient_id: true, patient_first_name: true, patient_last_name: true }
                        }
                    }
                },
                prescription_items: {
                    include: { medicine_master: true },
                    orderBy: { prescription_item_id: "asc" }
                }
            }
        });
    }
}
exports.PharmacyRepository = PharmacyRepository;
