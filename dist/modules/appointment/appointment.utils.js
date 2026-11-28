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
exports.indexToLetter = indexToLetter;
exports.letterToIndex = letterToIndex;
exports.formatHourSlotToken = formatHourSlotToken;
exports.parseHourSlotToken = parseHourSlotToken;
exports.computeHourIndexAndRange = computeHourIndexAndRange;
exports.findEarliestGapInWindow = findEarliestGapInWindow;
exports.computeSandwichPlan = computeSandwichPlan;
exports.resolveAppointmentSlotInShift = resolveAppointmentSlotInShift;
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
// IST (Asia/Kolkata, UTC+05:30) is the FALLBACK hospital timezone and the
// value every existing branch carries by default (branch.timezone). These
// keep their historical names; branch-aware callers should use
// getTodayIn(await getBranchTimezone(branchId)) from utils/timezone instead.
// Implementation now lives in ONE place (utils/timezone) - no more copies.
const timezone_1 = require("../../utils/timezone");
function getNowInIST() {
    return (0, timezone_1.getNowIn)(timezone_1.DEFAULT_TIMEZONE);
}
function getTodayInIST() {
    return (0, timezone_1.getTodayIn)(timezone_1.DEFAULT_TIMEZONE);
}
function getNowMinutesInIST() {
    return (0, timezone_1.getNowMinutesIn)(timezone_1.DEFAULT_TIMEZONE);
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
function indexToLetter(index) {
    let result = "";
    let num = index;
    while (num >= 0) {
        result = String.fromCharCode(65 + (num % 26)) + result;
        num = Math.floor(num / 26) - 1;
    }
    return result;
}
function letterToIndex(letter) {
    let result = 0;
    for (let i = 0; i < letter.length; i++) {
        result = result * 26 + (letter.charCodeAt(i) - 64);
    }
    return result - 1;
}
function formatHourSlotToken(hourIndex, slotIndexInHour, suffix) {
    const letter = indexToLetter(slotIndexInHour);
    const base = `${hourIndex}${letter}`;
    return suffix ? `${base}-${suffix}` : base;
}
function parseHourSlotToken(token) {
    if (!token)
        return null;
    const match = token.trim().match(/^(\d+)([A-Z]+)(?:-(.+))?$/i);
    if (!match)
        return null;
    const hourIndex = parseInt(match[1], 10);
    const letter = match[2].toUpperCase();
    const slotIndex = letterToIndex(letter);
    const suffix = match[3];
    return { hourIndex, letter, slotIndex, suffix };
}
function computeHourIndexAndRange(apptMinutes, schedules) {
    // The slot prefix is the appointment's clock hour in 24-hour form
    // (e.g. 9 AM -> "9A", 9 PM -> "21A"). Using the real clock hour keeps
    // every hour distinct, so two different hours can never share a prefix,
    // and the prefix stays anchored to the start time even when a
    // consultation spills into the next hour.
    //
    // `schedules` is kept in the signature for backward compatibility with
    // existing callers, but the prefix no longer depends on cumulative shift
    // ordering (which collided when shifts had gaps or overlapped).
    void schedules;
    const clockHour = Math.floor(apptMinutes / 60) % 24;
    return {
        hourIndex: clockHour,
        hourStartMinutes: clockHour * 60,
        hourEndMinutes: clockHour * 60 + 60
    };
}
/**
 * Finds the earliest contiguous free gap inside [baselineStart, windowEnd)
 * that fits `neededDuration` without overlapping any active appointment or exceeding `shiftEndMin`.
 */
function findEarliestGapInWindow(baselineStart, windowEnd, shiftEndMin, neededDuration, sortedIntervals) {
    let cursor = baselineStart;
    let nextBookedStart = shiftEndMin;
    for (const appt of sortedIntervals) {
        if (appt.end <= cursor)
            continue;
        if (appt.start > cursor) {
            const gap = appt.start - cursor;
            if (gap >= neededDuration) {
                nextBookedStart = appt.start;
                break;
            }
        }
        cursor = Math.max(cursor, appt.end);
        if (cursor >= windowEnd)
            break;
    }
    if (cursor < windowEnd && nextBookedStart === shiftEndMin) {
        const afterCursor = sortedIntervals.find((a) => a.start >= cursor);
        if (afterCursor) {
            nextBookedStart = afterCursor.start;
        }
    }
    const contiguousFreeMinutes = Math.max(0, nextBookedStart - cursor);
    const hasSufficientSpace = cursor < windowEnd &&
        contiguousFreeMinutes >= neededDuration &&
        cursor + neededDuration <= shiftEndMin;
    return {
        candidateStart: cursor,
        contiguousFreeMinutes,
        hasSufficientSpace
    };
}
/**
 * Computes a non-collapsing, shift-scoped sandwich insertion plan.
 * - Never touches appointments before the insertion point.
 * - Never pulls downstream appointments earlier into vacant/cancelled gaps (newStart >= existingStart).
 * - Assigns a chronological sub-token (e.g. 5A-1) based on the predecessor in the target hour.
 */
function computeSandwichPlan(params) {
    const { targetDuration, targetToken, shiftStartMin, isToday, nowMinutes, insertAfterId, shiftActiveAppts, daySchedules } = params;
    const sorted = [...shiftActiveAppts].sort((a, b) => a.startMin - b.startMin);
    let insertIdx = 0;
    let insertStartMin = shiftStartMin;
    if (insertAfterId && insertAfterId !== "NEXT_IN_LINE") {
        const anchorIdx = sorted.findIndex((a) => a.appointment_id === insertAfterId);
        if (anchorIdx !== -1) {
            insertIdx = anchorIdx + 1;
            const anchor = sorted[anchorIdx];
            insertStartMin = anchor.startMin + anchor.duration;
        }
        else {
            insertIdx = sorted.length;
            if (sorted.length > 0) {
                const last = sorted[sorted.length - 1];
                insertStartMin = last.startMin + last.duration;
            }
        }
    }
    else {
        let lastFinishedEnd = shiftStartMin;
        for (let i = 0; i < sorted.length; i++) {
            const st = sorted[i].status;
            if (st === "COMPLETED" || st === "IN_CONSULTATION") {
                insertIdx = i + 1;
                lastFinishedEnd = Math.max(lastFinishedEnd, sorted[i].startMin + sorted[i].duration);
            }
        }
        insertStartMin = lastFinishedEnd;
    }
    if (isToday) {
        insertStartMin = Math.max(insertStartMin, nowMinutes);
    }
    const sandwichedStartMin = insertStartMin;
    let cursor = sandwichedStartMin + targetDuration;
    const downstreamUpdates = [];
    for (let i = insertIdx; i < sorted.length; i++) {
        const appt = sorted[i];
        if (appt.status === "COMPLETED" || appt.status === "IN_CONSULTATION") {
            cursor = Math.max(cursor, appt.startMin + appt.duration);
            continue;
        }
        // Never pull a downstream appointment earlier into a vacant gap
        const pushedStart = Math.max(appt.startMin, cursor);
        if (pushedStart !== appt.startMin) {
            downstreamUpdates.push({
                appointment_id: appt.appointment_id,
                newStartMin: pushedStart,
                duration: appt.duration,
                status: appt.status,
                token_number: appt.token_number
            });
        }
        cursor = pushedStart + appt.duration;
    }
    // Determine chronological sub-token at sandwichedStartMin
    const { hourIndex, hourStartMinutes, hourEndMinutes } = computeHourIndexAndRange(sandwichedStartMin % 1440, daySchedules);
    const existingTokens = new Set();
    let latestPredecessorBase = null;
    const usedIndices = new Set();
    for (let i = 0; i < sorted.length; i++) {
        const appt = sorted[i];
        if (!appt.token_number)
            continue;
        existingTokens.add(appt.token_number.toUpperCase());
        const parsed = parseHourSlotToken(appt.token_number);
        if (!parsed || parsed.hourIndex !== hourIndex)
            continue;
        if (!parsed.suffix) {
            usedIndices.add(parsed.slotIndex);
        }
        const normApptStart = appt.startMin % 1440;
        const normTargetStart = sandwichedStartMin % 1440;
        const inHour = hourEndMinutes > 1440
            ? normApptStart >= hourStartMinutes || normApptStart < hourEndMinutes % 1440
            : normApptStart >= hourStartMinutes && normApptStart < hourEndMinutes;
        // Only appointments strictly before insertIdx are predecessors; downstream appointments
        // at >= insertIdx may have had their pre-push startMin == sandwichedStartMin.
        if (i < insertIdx && inHour && normApptStart <= normTargetStart) {
            latestPredecessorBase = `${parsed.hourIndex}${parsed.letter}`;
        }
    }
    let sandwichedToken;
    if (latestPredecessorBase) {
        let sub = 1;
        while (existingTokens.has(`${latestPredecessorBase}-${sub}`.toUpperCase())) {
            sub++;
        }
        sandwichedToken = `${latestPredecessorBase}-${sub}`;
    }
    else {
        const parsedTarget = targetToken ? parseHourSlotToken(targetToken) : null;
        if (parsedTarget && parsedTarget.hourIndex === hourIndex) {
            const base = `${parsedTarget.hourIndex}${parsedTarget.letter}`;
            if (parsedTarget.suffix) {
                sandwichedToken = targetToken;
            }
            else {
                let sub = 1;
                while (existingTokens.has(`${base}-${sub}`.toUpperCase())) {
                    sub++;
                }
                sandwichedToken = `${base}-${sub}`;
            }
        }
        else {
            let nextIndex = 0;
            while (usedIndices.has(nextIndex)) {
                nextIndex++;
            }
            sandwichedToken = formatHourSlotToken(hourIndex, nextIndex, "1");
        }
    }
    return {
        sandwichedStartMin,
        sandwichedToken,
        downstreamUpdates
    };
}
/**
 * Shared 1-hour slot resolution & overlap check used by BOTH bookAppointment and updateAppointment.
 * - If `preserveExactTimeIfFree` is true (metadata/same-slot edit), keeps `normRequestedMinutes`
 *   when it fits cleanly inside `[shiftStartMin, shiftEndMin]` with zero overlap.
 * - Otherwise uses `findEarliestGapInWindow` inside the 1-hour block `[blockStartMinutes, blockEndMinutes)`
 *   to locate the earliest free gap that fits `durationMinutes`.
 */
function resolveAppointmentSlotInShift(params) {
    const { normRequestedMinutes, shiftStartMin, shiftEndMin, isToday, nowMinutes, durationMinutes, sortedIntervals, preserveExactTimeIfFree = false } = params;
    const slotOffset = Math.floor(Math.max(0, normRequestedMinutes - shiftStartMin) / 60) * 60;
    const blockStartMinutes = shiftStartMin + slotOffset;
    const blockEndMinutes = Math.min(blockStartMinutes + 60, shiftEndMin);
    if (preserveExactTimeIfFree) {
        const reqEnd = normRequestedMinutes + durationMinutes;
        const overlapsExisting = sortedIntervals.some((iv) => normRequestedMinutes < iv.end && reqEnd > iv.start);
        if (!overlapsExisting &&
            normRequestedMinutes >= shiftStartMin &&
            reqEnd <= shiftEndMin) {
            return {
                calculatedStartMinutes: normRequestedMinutes,
                blockStartMinutes,
                blockEndMinutes,
                dayOffset: Math.floor(normRequestedMinutes / 1440),
                usedExactPreservedTime: true
            };
        }
    }
    const baselineStart = isToday ? Math.max(blockStartMinutes, nowMinutes) : blockStartMinutes;
    const { candidateStart: calculatedStartMinutes, contiguousFreeMinutes, hasSufficientSpace } = findEarliestGapInWindow(baselineStart, blockEndMinutes, shiftEndMin, durationMinutes, sortedIntervals);
    if (calculatedStartMinutes >= blockEndMinutes) {
        throw new Error("This 1-hour session window has no remaining available time slots.");
    }
    if (!hasSufficientSpace || contiguousFreeMinutes < durationMinutes) {
        throw new Error("The requested consultation duration exceeds the available free time in this session.");
    }
    return {
        calculatedStartMinutes,
        blockStartMinutes,
        blockEndMinutes,
        dayOffset: Math.floor(calculatedStartMinutes / 1440),
        usedExactPreservedTime: false
    };
}
