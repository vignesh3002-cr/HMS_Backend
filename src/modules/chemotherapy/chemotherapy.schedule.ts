import { Prisma } from "@prisma/client";
import { CYCLE_STATUS, PLAN_ORDER_STATUS } from "./chemotherapy.constants";

/*
 * Planned date of every cycle day of a chemotherapy plan, calculated
 * from the plan's treatment start (never stored):
 *
 *   - Cycle 1 / Day 1 is the treatment start date.
 *   - Within a cycle each next day is one day later, plus one rest day
 *     when that day has no medicine in the protocol:
 *       date(Day N) = date(Day N-1) + 1 (+1 if Day N has no medicine).
 *   - The next cycle's Day 1 is the previous cycle's last day + the cycle
 *     interval + 1:
 *       6-day protocol, no medicine on Day 3, 7-day interval, start 10-10:
 *       C1 D1 10-10, D2 11-10, D3 13-10, ... D6 16-10, C2 D1 24-10.
 *
 * Each day's date can later be moved on its own: the doctor's date is
 * kept on that day's chemotherapy_plan_order.planned_date and changes
 * only that day.
 */

export interface PlanScheduleRow {
    cycle_number: number;
    cycle_day: number;
    planned_date: Date;
    medication_day: boolean;
}

interface ScheduleInputs {
    daysPerCycle: number;
    medicationDays: Set<number>;
    intervalDays: number;
}

const addUtcDays = (date: Date, days: number) => {
    const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    next.setUTCDate(next.getUTCDate() + days);
    return next;
};

const dateOnly = (date: Date) => addUtcDays(date, 0);

/* One cycle's days from its Day 1 date. */
export function buildCycleDays(cycleNumber: number, dayOne: Date, inputs: Pick<ScheduleInputs, "daysPerCycle" | "medicationDays">): PlanScheduleRow[] {

    const rows: PlanScheduleRow[] = [];
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
export const nextCycleDayOne = (lastDay: Date, intervalDays: number) => addUtcDays(lastDay, intervalDays + 1);

/* What the rule needs, from the plan's protocol (else its own items):
   days per cycle, the days that carry medicine, and the cycle interval. */
async function scheduleInputs(
    tx: Prisma.TransactionClient,
    plan: { chemotherapy_plan_id: string; source_protocol_id: string | null; cycle_interval_days: number | null }
): Promise<ScheduleInputs> {

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
    const itemDay = (item: { administration_day: number | null; cycle_day?: number | null }) => {
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


export interface PlanScheduleDay extends PlanScheduleRow {
    /* true when the doctor moved this day's date (kept on its order row). */
    edited: boolean;
}

/*
 * The planned date of every cycle day of the plan, calculated with the
 * rule above - nothing is stored. A cycle that already started keeps its
 * recorded Day 1 (the cycles after it follow on from there), and a day
 * whose Start Date the doctor moved (chemotherapy_plan_order.planned_date)
 * shows that date instead; only that day changes.
 */
export async function computePlanSchedule(
    db: Prisma.TransactionClient,
    plan: {
        chemotherapy_plan_id: string;
        source_protocol_id: string | null;
        cycle_interval_days: number | null;
        planned_cycles: number;
        treatment_start_date: Date;
    }
): Promise<PlanScheduleDay[]> {

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

    const started = (number: number) => {
        const cycle = cycles.find((row) => row.cycle_number === number);
        return cycle?.cycle_status === CYCLE_STATUS.IN_PROGRESS ||
            cycle?.cycle_status === CYCLE_STATUS.COMPLETED ||
            orders.some((order) =>
                order.cycle_number === number &&
                (order.order_status === PLAN_ORDER_STATUS.IN_ADMINISTRATION || order.order_status === PLAN_ORDER_STATUS.COMPLETED)
            );
    };

    const days: PlanScheduleDay[] = [];
    let previousLastDay: Date | null = null;

    for (let number = 1; number <= plan.planned_cycles; number++) {

        const cycle = cycles.find((row) => row.cycle_number === number);
        const recordedDayOne = cycle ? (cycle.rescheduled_date ?? cycle.actual_date ?? cycle.planned_date) : null;

        const dayOne = started(number) && recordedDayOne
            ? recordedDayOne
            : number === 1 || !previousLastDay
                ? plan.treatment_start_date
                : nextCycleDayOne(previousLastDay, inputs.intervalDays);

        const cycleDays = buildCycleDays(number, dayOne, inputs);
        // The next cycle follows the calculated last day, not an edit.
        previousLastDay = cycleDays[cycleDays.length - 1].planned_date;

        for (const day of cycleDays) {
            const edited = orders.find(
                (order) => order.cycle_number === number && order.cycle_day === day.cycle_day && order.planned_date
            )?.planned_date;
            days.push({ ...day, planned_date: edited ?? day.planned_date, edited: !!edited });
        }

    }

    return days;

}
