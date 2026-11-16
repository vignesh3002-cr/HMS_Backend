import { DAY_OF_WEEK_NAMES } from "./appointment.constants";

export function parseDateOnly(date: string): Date {
    const [year, month, day] = date.split("-").map(Number);

    return new Date(Date.UTC(year, month - 1, day));
}

export function toDayOfWeek(date: Date): string {
    return DAY_OF_WEEK_NAMES[date.getUTCDay()];
}

export function formatDateOnly(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// Monday-start week containing `date` (a UTC-midnight date from parseDateOnly).
export function getWeekRange(date: Date): { start: Date; end: Date } {
    const dayOfWeek = date.getUTCDay(); // 0=Sun..6=Sat
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const start = new Date(date);
    start.setUTCDate(start.getUTCDate() - diffToMonday);

    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);

    return { start, end };
}

export function timeStringToDate(time: string): Date {
    const [hours, minutes] = time.split(":").map(Number);

    return new Date(Date.UTC(
        1970,
        0,
        1,
        hours,
        minutes,
        0,
        0
    ));
}

export function timeToMinutes(time: Date): number {
    return time.getUTCHours() * 60 + time.getUTCMinutes();
}

export function formatTimeOfDay(time: Date): string {
    const hours = String(time.getUTCHours()).padStart(2, "0");
    const minutes = String(time.getUTCMinutes()).padStart(2, "0");

    return `${hours}:${minutes}`;
}

export function timeStringToMinutes(time: string): number {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
}
// IST (Asia/Kolkata, UTC+05:30) is the FALLBACK hospital timezone and the
// value every existing branch carries by default (branch.timezone). These
// keep their historical names; branch-aware callers should use
// getTodayIn(await getBranchTimezone(branchId)) from utils/timezone instead.
// Implementation now lives in ONE place (utils/timezone) - no more copies.
import {
    getNowIn,
    getTodayIn,
    getNowMinutesIn,
    DEFAULT_TIMEZONE,
} from "../../utils/timezone";

export function getNowInIST(): Date {
    return getNowIn(DEFAULT_TIMEZONE);
}

export function getTodayInIST(): string {
    return getTodayIn(DEFAULT_TIMEZONE);
}

export function getNowMinutesInIST(): number {
    return getNowMinutesIn(DEFAULT_TIMEZONE);
}


// Slots only include start times that leave a full consultation before end_time,
// so a shift never has a slot booked that would run past the doctor's working hours.
export function generateTimeSlots(
    startTime: Date,
    endTime: Date,
    consultationMinutes: number
): string[] {

    const slots: string[] = [];
    const step = consultationMinutes > 0 ? consultationMinutes : 30;
    const startMinutes = timeToMinutes(startTime);
    let endMinutes = timeToMinutes(endTime);
    if (endMinutes <= startMinutes) {
        endMinutes += 1440; // Spans past midnight into next day
    }

    for (
        let minutes = startMinutes;
        minutes + step <= endMinutes;
        minutes += step
    ) {

        const normalizedMinutes = minutes % 1440;
        const hours = Math.floor(normalizedMinutes / 60);
        const mins = normalizedMinutes % 60;

        slots.push(
            `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`
        );

    }

    return slots;

}