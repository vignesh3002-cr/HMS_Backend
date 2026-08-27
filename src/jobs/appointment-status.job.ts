import prisma from "../config/prisma";
import { APPOINTMENT_STATUS } from "../modules/appointment/appointment.constants";

// The hospital operates in Asia/Kolkata (IST), UTC+05:30 with no daylight
// saving -- same fixed-offset convention as AddAppointment.tsx on the
// frontend, so the day boundary behaves identically regardless of the
// server/browser timezone.
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

// Written to cancelled_by so staff can tell automatic cancellations apart
// from manual ones at a glance.
const AUTO_CANCELLED_BY = "Auto cancelled";
const AUTO_CANCEL_REASON = "Auto-cancelled: appointment day has passed";

const RUN_INTERVAL_MS = 5 * 60 * 1000;

// Only these statuses are swept. Terminal statuses (COMPLETED / CANCELLED /
// NO_SHOW) and in-flight clinical states (CHECKED_IN / IN_CONSULTATION) plus
// workflow flags (RESCHEDULE_REQUIRED / TRANSFER_REVIEW_REQUIRED) are never
// touched, so no other flow can be affected by this job.
const SWEEPABLE_STATUSES = [
    APPOINTMENT_STATUS.SCHEDULED,
    APPOINTMENT_STATUS.RESCHEDULED,
];

let isRunning = false;

function getTodayISTDateString(): string {
    const nowIST = new Date(Date.now() + IST_OFFSET_MS);
    const year = nowIST.getUTCFullYear();
    const month = String(nowIST.getUTCMonth() + 1).padStart(2, "0");
    const day = String(nowIST.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

/**
 * Cancels every SCHEDULED / RESCHEDULED appointment whose appointment_date
 * is strictly before today (IST). appointment_date is a @db.Date column
 * (UTC-midnight anchor), so a plain "less than today" predicate selects all
 * fully-elapsed days while never touching today's or future appointments.
 *
 * Mirrors the exact write shape of the manual cancellation flow
 * (repository.updateAppointmentStatus): status + cancel_reason +
 * cancelled_at timestamp + cancelled_by + notification_status, so downstream
 * consumers see auto-cancellations identical to hand-made ones apart from
 * the "Auto cancelled" actor.
 */
export async function autoCancelElapsedAppointments(): Promise<number> {
    const todayIST = getTodayISTDateString();

    const result = await prisma.appointment_history.updateMany({
        where: {
            status: { in: SWEEPABLE_STATUSES },
            appointment_date: {
                lt: new Date(`${todayIST}T00:00:00.000Z`),
            },
        },
        data: {
            status: APPOINTMENT_STATUS.CANCELLED,
            cancel_reason: AUTO_CANCEL_REASON,
            cancelled_by: AUTO_CANCELLED_BY,
            cancelled_at: new Date(),
            notification_status: "NOT_REQUIRED",
        },
    });

    return result.count;
}

/**
 * Starts the background sweep: once immediately at startup (self-heals any
 * days missed while the server was down), then on a fixed interval. A
 * re-entrancy guard keeps overlapping runs impossible even if one sweep is
 * slow; each run is a single batched UPDATE, so it stays cheap and cannot
 * interleave partial writes.
 */
export function startAppointmentStatusJob() {
    const run = async () => {
        if (isRunning) return;
        isRunning = true;
        try {
            const count = await autoCancelElapsedAppointments();
            if (count > 0) {
                console.log(
                    `[appointment-status] Auto-cancelled ${count} elapsed appointment(s)`
                );
            }
        } catch (error) {
            console.error("[appointment-status] Sweep failed:", error);
        } finally {
            isRunning = false;
        }
    };

    void run();

    const interval = setInterval(() => void run(), RUN_INTERVAL_MS);
    // Don't keep the node process alive purely for this timer.
    interval.unref?.();

    return interval;
}
