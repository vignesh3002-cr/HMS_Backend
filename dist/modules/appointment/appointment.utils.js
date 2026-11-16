"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDateOnly = parseDateOnly;
exports.toDayOfWeek = toDayOfWeek;
exports.formatDateOnly = formatDateOnly;
exports.addDays = addDays;
exports.getWeekRange = getWeekRange;
exports.parseTimeToMinutes = parseTimeToMinutes;
exports.timeStringToDate = timeStringToDate;
exports.timeToMinutes = timeToMinutes;
exports.formatTimeOfDay = formatTimeOfDay;
exports.timeStringToMinutes = timeStringToMinutes;
exports.getNowInIST = getNowInIST;
exports.getTodayInIST = getTodayInIST;
exports.getNowMinutesInIST = getNowMinutesInIST;
exports.generateTimeSlots = generateTimeSlots;
exports.formatMinutesTo12Hour = formatMinutesTo12Hour;
exports.minutesToHHmm = minutesToHHmm;
const appointment_constants_1 = require("./appointment.constants");
function parseDateOnly(date) {
    const [year, month, day] = date.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
}
function toDayOfWeek(date) {
    return appointment_constants_1.DAY_OF_WEEK_NAMES[date.getUTCDay()];
}
function formatDateOnly(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
function addDays(date, days) {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
}
// Monday-start week containing `date` (a UTC-midnight date from parseDateOnly).
function getWeekRange(date) {
    const dayOfWeek = date.getUTCDay(); // 0=Sun..6=Sat
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const start = new Date(date);
    start.setUTCDate(start.getUTCDate() - diffToMonday);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    return { start, end };
}
function parseTimeToMinutes(time) {
    if (!time)
        return 0;
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
    if (isPM && hours < 12)
        hours += 12;
    if (isAM && hours === 12)
        hours = 0;
    return hours * 60 + minutes;
}
function timeStringToDate(time) {
    const totalMinutes = parseTimeToMinutes(time);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0, 0));
}
function timeToMinutes(time) {
    return parseTimeToMinutes(time);
}
function formatTimeOfDay(time) {
    const hours = String(time.getUTCHours()).padStart(2, "0");
    const minutes = String(time.getUTCMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
}
function timeStringToMinutes(time) {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
}
// Asia/Kolkata (IST) is the hospital's reference timezone. IST is UTC+05:30
// with no daylight saving, so "now" in IST is just UTC now shifted by a fixed
// offset -- independent of the host/server timezone (Local dev vs Vercel).
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
function getNowInIST() {
    return new Date(Date.now() + IST_OFFSET_MS);
}
function getTodayInIST() {
    return formatDateOnly(getNowInIST());
}
function getNowMinutesInIST() {
    const now = getNowInIST();
    return now.getUTCHours() * 60 + now.getUTCMinutes();
}
// Slots only include start times that leave a full consultation before end_time,
// so a shift never has a slot booked that would run past the doctor's working hours.
function generateTimeSlots(startTime, endTime, consultationMinutes) {
    const slots = [];
    const step = consultationMinutes > 0 ? consultationMinutes : 30;
    const startMinutes = timeToMinutes(startTime);
    let endMinutes = timeToMinutes(endTime);
    if (endMinutes <= startMinutes) {
        endMinutes += 1440; // Spans past midnight into next day
    }
    for (let minutes = startMinutes; minutes + step <= endMinutes; minutes += step) {
        const normalizedMinutes = minutes % 1440;
        const hours = Math.floor(normalizedMinutes / 60);
        const mins = normalizedMinutes % 60;
        slots.push(`${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`);
    }
    return slots;
}
function formatMinutesTo12Hour(minutes) {
    const hours = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    const ampm = hours >= 12 ? "PM" : "AM";
    const h12 = hours % 12 || 12;
    return `${String(h12).padStart(2, "0")}:${String(mins).padStart(2, "0")} ${ampm}`;
}
function minutesToHHmm(minutes) {
    const normalized = minutes % 1440;
    const hours = Math.floor(normalized / 60);
    const mins = normalized % 60;
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}
