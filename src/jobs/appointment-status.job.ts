import prisma from "../config/prisma";
import { APPOINTMENT_STATUS } from "../modules/appointment/appointment.constants";

// The hospital operates in Asia/Kolkata (IST), UTC+05:30 with no daylight
// saving -- same fixed-offset convention as AddAppointment.tsx on the
// frontend, so the day boundary behaves identically regardless of the
// server/browser timezone.
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

const RUN_INTERVAL_MS = 5 * 60 * 1000;

let isRunning = false;

function getTodayISTDateString(): string {
    const nowIST = new Date(Date.now() + IST_OFFSET_MS);
    const year = nowIST.getUTCFullYear();
    const month = String(nowIST.getUTCMonth() + 1).padStart(2, "0");
    const day = String(nowIST.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

/**
 * Marks every appointment whose appointment_date is strictly before today
 * (IST) as NO_SHOW, regardless of current status. appointment_date is a
 * @db.Date column (UTC-midnight anchor), so a plain "less than today"
 * predicate selects all fully-elapsed days while never touching today's or
 * future appointments.
 */
export async function autoMarkNoShowElapsedAppointments(): Promise<number> {
    const todayIST = getTodayISTDateString();

    const result = await prisma.appointment_history.updateMany({
        where: {
            appointment_date: {
                lt: new Date(`${todayIST}T00:00:00.000Z`),
            },
        },
        data: {
            status: APPOINTMENT_STATUS.NO_SHOW,
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
            const count = await autoMarkNoShowElapsedAppointments();
            if (count > 0) {
                console.log(
                    `[appointment-status] Auto-marked ${count} elapsed appointment(s) as NO_SHOW`
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
