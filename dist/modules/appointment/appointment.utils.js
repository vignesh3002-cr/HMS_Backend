"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDateOnly = parseDateOnly;
exports.toDayOfWeek = toDayOfWeek;
exports.timeStringToDate = timeStringToDate;
exports.timeToMinutes = timeToMinutes;
exports.formatTimeOfDay = formatTimeOfDay;
exports.timeStringToMinutes = timeStringToMinutes;
exports.generateTimeSlots = generateTimeSlots;
const appointment_constants_1 = require("./appointment.constants");
function parseDateOnly(date) {
    const [year, month, day] = date.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
}
function toDayOfWeek(date) {
    return appointment_constants_1.DAY_OF_WEEK_NAMES[date.getUTCDay()];
}
function timeStringToDate(time) {
    const [hours, minutes] = time.split(":").map(Number);
    return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0, 0));
}
function timeToMinutes(time) {
    return time.getUTCHours() * 60 + time.getUTCMinutes();
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
// Slots only include start times that leave a full consultation before end_time,
// so a shift never has a slot booked that would run past the doctor's working hours.
function generateTimeSlots(startTime, endTime, consultationMinutes) {
    const slots = [];
    const step = consultationMinutes > 0 ? consultationMinutes : 30;
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    for (let minutes = startMinutes; minutes + step <= endMinutes; minutes += step) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        slots.push(`${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`);
    }
    return slots;
}
