import { DAY_OF_WEEK_NAMES } from "./appointment.constants";

export function parseDateOnly(date: string): Date {
    const [year, month, day] = date.split("-").map(Number);

    return new Date(Date.UTC(year, month - 1, day));
}

export function toDayOfWeek(date: Date): string {
    return DAY_OF_WEEK_NAMES[date.getUTCDay()];
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