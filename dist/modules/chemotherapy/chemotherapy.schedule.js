"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextCycleDayOne = void 0;
exports.buildCycleDays = buildCycleDays;
exports.computePlanSchedule = computePlanSchedule;
const chemotherapy_constants_1 = require("./chemotherapy.constants");
const addUtcDays = (date, days) => {
    const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    next.setUTCDate(next.getUTCDate() + days);
    return next;
};
const dateOnly = (date) => addUtcDays(date, 0);
/* One cycle's days from its Day 1 date. */
function buildCycleDays(cycleNumber, dayOne, inputs) {
    const rows = [];
    let date = dateOnly(dayOne);
    for (let day = 1; day <= inputs.daysPerCycle; day++) {
        const medication = inputs.medicationDays.has(day);
        if (day > 1) {
            date = addUtcDays(date, medication ? 1 : 2);
        }
        rows.push({ cycle_number: cycleNumber, cycle_day: day, planned_date: date, medication_day: medication });
    }
    return rows;
}
/* Day 1 of the cycle after one ending on `lastDay`. */
const nextCycleDayOne = (lastDay, intervalDays) => addUtcDays(lastDay, intervalDays + 1);
exports.nextCycleDayOne = nextCycleDayOne;
/* What the rule needs, from the plan's protocol (else its own items):
   days per cycle, the days that carry medicine, and the cycle interval. */
async function scheduleInputs(tx, plan) {
    const protocol = plan.source_protocol_id
        ? await tx.chemotherapy_regimen_protocol.findUnique({
            where: { protocol_id: plan.source_protocol_id },
            select: {
                no_of_days: true,
                cycle_interval_days: true,
                chemotherapy_regimen_protocol_items: {
                    where: { OR: [{ active_status: 1 }, { active_status: null }] },
                    select: { administration_day: true, cycle_day: true }
                }
            }
        })
        : null;
    // Same as the Chemotherapy Order's day picker: an item's day is its
    // administration_day, else cycle_day, else Day 1.
    const itemDay = (item) => {
        const day = Number(item.administration_day ?? item.cycle_day);
        return Number.isFinite(day) && day > 0 ? day : 1;
    };
    let days = (protocol?.chemotherapy_regimen_protocol_items ?? []).map(itemDay);
    if (days.length === 0) {
        const planItems = await tx.chemotherapy_plan_items.findMany({
            where: { chemotherapy_plan_id: plan.chemotherapy_plan_id, plan_order_id: null, active_status: 1 },
            select: { administration_day: true }
        });
        days = planItems.map(itemDay);
    }
    const medicationDays = new Set(days.length > 0 ? days : [1]);
    const lastMedicationDay = Math.max(...medicationDays);
    return {
        daysPerCycle: Math.max(protocol?.no_of_days ?? 0, lastMedicationDay, 1),
        medicationDays,
        intervalDays: Math.max(plan.cycle_interval_days ?? protocol?.cycle_interval_days ?? 0, 0)
    };
}
/*
 * The planned date of every cycle day of the plan, calculated with the
 * rule above - nothing is stored. A cycle that already started keeps its
 * recorded Day 1 (the cycles after it follow on from there), and a day
 * whose Start Date the doctor moved (chemotherapy_plan_order.planned_date)
 * shows that date instead; only that day changes.
 */
async function computePlanSchedule(db, plan) {
    const [inputs, cycles, orders] = await Promise.all([
        scheduleInputs(db, plan),
        db.chemotherapy_cycle.findMany({
            where: { chemotherapy_plan_id: plan.chemotherapy_plan_id, active_status: 1 },
            select: { cycle_number: true, cycle_status: true, planned_date: true, rescheduled_date: true, actual_date: true }
        }),
        db.chemotherapy_plan_order.findMany({
            where: { chemotherapy_plan_id: plan.chemotherapy_plan_id },
            select: { cycle_number: true, cycle_day: true, order_status: true, planned_date: true }
        })
    ]);
    const started = (number) => {
        const cycle = cycles.find((row) => row.cycle_number === number);
        return cycle?.cycle_status === chemotherapy_constants_1.CYCLE_STATUS.IN_PROGRESS ||
            cycle?.cycle_status === chemotherapy_constants_1.CYCLE_STATUS.COMPLETED ||
            orders.some((order) => order.cycle_number === number &&
                (order.order_status === chemotherapy_constants_1.PLAN_ORDER_STATUS.IN_ADMINISTRATION || order.order_status === chemotherapy_constants_1.PLAN_ORDER_STATUS.COMPLETED));
    };
    const days = [];
    let previousLastDay = null;
    for (let number = 1; number <= plan.planned_cycles; number++) {
        const cycle = cycles.find((row) => row.cycle_number === number);
        const recordedDayOne = cycle ? (cycle.rescheduled_date ?? cycle.actual_date ?? cycle.planned_date) : null;
        const dayOne = started(number) && recordedDayOne
            ? recordedDayOne
            : number === 1 || !previousLastDay
                ? plan.treatment_start_date
                : (0, exports.nextCycleDayOne)(previousLastDay, inputs.intervalDays);
        const cycleDays = buildCycleDays(number, dayOne, inputs);
        // The next cycle follows the calculated last day, not an edit.
        previousLastDay = cycleDays[cycleDays.length - 1].planned_date;
        for (const day of cycleDays) {
            const edited = orders.find((order) => order.cycle_number === number && order.cycle_day === day.cycle_day && order.planned_date)?.planned_date;
            days.push({ ...day, planned_date: edited ?? day.planned_date, edited: !!edited, calculated_date: day.planned_date });
        }
    }
    return days;
}
