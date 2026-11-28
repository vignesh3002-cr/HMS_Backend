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

export function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
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

export function parseTimeToMinutes(time?: string | Date | null): number {
    if (!time) return 0;
    if (time instanceof Date) {
        return isNaN(time.getTime()) ? 0 : time.getUTCHours() * 60 + time.getUTCMinutes();
    }
    const str = String(time).trim();
    if (str.includes("T")) {
        const d = new Date(str);
        return isNaN(d.getTime()) ? 0 : d.getUTCHours() * 60 + d.getUTCMinutes();
    }
    const isPM = /pm/i.test(str);
    const isAM = /am/i.test(str);
    const cleaned = str.replace(/[^\d:]/g, "");
    const parts = cleaned.split(":").map(Number);
    let hours = parts[0] || 0;
    const minutes = parts[1] || 0;
    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
    return hours * 60 + minutes;
}

export function timeStringToDate(time: string): Date {
    const totalMinutes = parseTimeToMinutes(time);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;

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

export function timeToMinutes(time: Date | string): number {
    return parseTimeToMinutes(time);
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
export function formatMinutesTo12Hour(minutes: number): string {
    const hours = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    const ampm = hours >= 12 ? "PM" : "AM";
    const h12 = hours % 12 || 12;
    return `${String(h12).padStart(2, "0")}:${String(mins).padStart(2, "0")} ${ampm}`;
}

export function minutesToHHmm(minutes: number): string {
    const normalized = minutes % 1440;
    const hours = Math.floor(normalized / 60);
    const mins = normalized % 60;
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function indexToLetter(index: number): string {
    let result = "";
    let num = index;
    while (num >= 0) {
        result = String.fromCharCode(65 + (num % 26)) + result;
        num = Math.floor(num / 26) - 1;
    }
    return result;
}

export function letterToIndex(letter: string): number {
    let result = 0;
    for (let i = 0; i < letter.length; i++) {
        result = result * 26 + (letter.charCodeAt(i) - 64);
    }
    return result - 1;
}

export function formatHourSlotToken(
    hourIndex: number,
    slotIndexInHour: number,
    suffix?: string | null
): string {
    const letter = indexToLetter(slotIndexInHour);
    const base = `${hourIndex}${letter}`;
    return suffix ? `${base}-${suffix}` : base;
}

export function parseHourSlotToken(token: string): {
    hourIndex: number;
    letter: string;
    slotIndex: number;
    suffix?: string;
} | null {
    if (!token) return null;
    const match = token.trim().match(/^(\d+)([A-Z]+)(?:-(.+))?$/i);
    if (!match) return null;
    const hourIndex = parseInt(match[1], 10);
    const letter = match[2].toUpperCase();
    const slotIndex = letterToIndex(letter);
    const suffix = match[3];
    return { hourIndex, letter, slotIndex, suffix };
}

export function computeHourIndexAndRange(
    apptMinutes: number,
    schedules: Array<{ start_time?: Date | string | null; end_time?: Date | string | null }>
): { hourIndex: number; hourStartMinutes: number; hourEndMinutes: number } {
    if (!schedules || schedules.length === 0) {
        const clockHour = Math.floor(apptMinutes / 60) % 24;
        const hourIndex = clockHour === 0 ? 12 : (clockHour > 12 ? clockHour - 12 : clockHour);
        return {
            hourIndex,
            hourStartMinutes: clockHour * 60,
            hourEndMinutes: clockHour * 60 + 60
        };
    }

    const sorted = [...schedules].filter(s => s.start_time && s.end_time).sort((a, b) => {
        return parseTimeToMinutes(a.start_time) - parseTimeToMinutes(b.start_time);
    });

    let precedingHours = 0;
    let matched = null;
    let matchedShiftStart = 0;

    for (const sched of sorted) {
        const sStart = parseTimeToMinutes(sched.start_time);
        let sEnd = parseTimeToMinutes(sched.end_time);
        if (sEnd <= sStart) sEnd += 1440;

        let checkAppt = apptMinutes;
        if (sEnd > 1440 && checkAppt < sStart) checkAppt += 1440;

        if (checkAppt >= sStart && checkAppt < sEnd) {
            matched = sched;
            matchedShiftStart = sStart;
            break;
        } else {
            const shiftDurationHours = Math.ceil((sEnd - sStart) / 60);
            precedingHours += shiftDurationHours;
        }
    }

    if (!matched) {
        const firstStart = sorted.length > 0 ? parseTimeToMinutes(sorted[0].start_time) : 9 * 60;
        const offset = Math.floor(Math.max(0, apptMinutes - firstStart) / 60);
        const hourIndex = offset + 1;
        const hourStartMinutes = (firstStart + offset * 60) % 1440;
        return {
            hourIndex,
            hourStartMinutes,
            hourEndMinutes: hourStartMinutes + 60
        };
    }

    let adjustedAppt = apptMinutes;
    let sEnd = parseTimeToMinutes(matched.end_time);
    if (sEnd <= matchedShiftStart) sEnd += 1440;
    if (sEnd > 1440 && adjustedAppt < matchedShiftStart) adjustedAppt += 1440;

    const hourOffset = Math.floor((adjustedAppt - matchedShiftStart) / 60);
    const hourIndex = precedingHours + hourOffset + 1;
    const hourStartMinutes = (matchedShiftStart + hourOffset * 60) % 1440;
    const hourEndMinutes = hourStartMinutes + 60;

    return {
        hourIndex,
        hourStartMinutes,
        hourEndMinutes
    };
}

/**
 * Finds the earliest contiguous free gap inside [baselineStart, windowEnd)
 * that fits `neededDuration` without overlapping any active appointment or exceeding `shiftEndMin`.
 */
export function findEarliestGapInWindow(
    baselineStart: number,
    windowEnd: number,
    shiftEndMin: number,
    neededDuration: number,
    sortedIntervals: Array<{ start: number; end: number }>
): { candidateStart: number; contiguousFreeMinutes: number; hasSufficientSpace: boolean } {
    let cursor = baselineStart;
    let nextBookedStart = shiftEndMin;

    for (const appt of sortedIntervals) {
        if (appt.end <= cursor) continue;
        if (appt.start > cursor) {
            const gap = appt.start - cursor;
            if (gap >= neededDuration) {
                nextBookedStart = appt.start;
                break;
            }
        }
        cursor = Math.max(cursor, appt.end);
        if (cursor >= windowEnd) break;
    }

    if (cursor < windowEnd && nextBookedStart === shiftEndMin) {
        const afterCursor = sortedIntervals.find((a) => a.start >= cursor);
        if (afterCursor) {
            nextBookedStart = afterCursor.start;
        }
    }

    const contiguousFreeMinutes = Math.max(0, nextBookedStart - cursor);
    const hasSufficientSpace =
        cursor < windowEnd &&
        contiguousFreeMinutes >= neededDuration &&
        cursor + neededDuration <= shiftEndMin;

    return {
        candidateStart: cursor,
        contiguousFreeMinutes,
        hasSufficientSpace
    };
}
