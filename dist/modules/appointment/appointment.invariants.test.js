"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const appointment_utils_1 = require("./appointment.utils");
const daySchedules = [
    { start_time: (0, appointment_utils_1.timeStringToDate)("09:00"), end_time: (0, appointment_utils_1.timeStringToDate)("13:00") }, // Morning shift
    { start_time: (0, appointment_utils_1.timeStringToDate)("22:00"), end_time: (0, appointment_utils_1.timeStringToDate)("23:00") } // Evening shift
];
// 1. Clock-hour prefixes (24-hour form): 9:15 AM -> "9A", 10 PM -> "22B"
{
    const h1 = (0, appointment_utils_1.computeHourIndexAndRange)(9 * 60 + 15, daySchedules);
    strict_1.default.equal(h1.hourIndex, 9);
    strict_1.default.equal((0, appointment_utils_1.formatHourSlotToken)(h1.hourIndex, 0), "9A");
    const h5 = (0, appointment_utils_1.computeHourIndexAndRange)(22 * 60, daySchedules);
    strict_1.default.equal(h5.hourIndex, 22);
    strict_1.default.equal((0, appointment_utils_1.formatHourSlotToken)(h5.hourIndex, 1), "22B");
}
// 2. Cross-hour boundary: the start time anchors the prefix (11:40 -> "11", 12:20 -> "12")
{
    const h1140 = (0, appointment_utils_1.computeHourIndexAndRange)(11 * 60 + 40, daySchedules);
    const h1220 = (0, appointment_utils_1.computeHourIndexAndRange)(12 * 60 + 20, daySchedules);
    strict_1.default.equal(h1140.hourIndex, 11);
    strict_1.default.equal(h1220.hourIndex, 12);
    strict_1.default.equal((0, appointment_utils_1.formatHourSlotToken)(h1220.hourIndex, 0), "12A");
}
// 3. Earliest-gap finder detects 10:00-10:40 PM (40m) gap before 22B at 10:40 PM
{
    const gap = (0, appointment_utils_1.findEarliestGapInWindow)(22 * 60, 23 * 60, 23 * 60, 20, [
        { start: 22 * 60 + 40, end: 23 * 60 } // 22B
    ]);
    strict_1.default.equal(gap.candidateStart, 22 * 60);
    strict_1.default.equal(gap.contiguousFreeMinutes, 40);
    strict_1.default.equal(gap.hasSufficientSpace, true);
}
// 4. After booking 22:00-22:20 (22A), next 20m gap is 22:20-22:40
{
    const gap2 = (0, appointment_utils_1.findEarliestGapInWindow)(22 * 60, 23 * 60, 23 * 60, 20, [
        { start: 22 * 60, end: 22 * 60 + 20 }, // 22A
        { start: 22 * 60 + 40, end: 23 * 60 } // 22B
    ]);
    strict_1.default.equal(gap2.candidateStart, 22 * 60 + 20);
    strict_1.default.equal(gap2.contiguousFreeMinutes, 20);
    strict_1.default.equal(gap2.hasSufficientSpace, true);
}
// 5. Sandwich in Evening shift leaves preceding slots & gaps intact, only pushes overlapping downstream
{
    const plan = (0, appointment_utils_1.computeSandwichPlan)({
        targetDuration: 20,
        targetToken: "22A",
        shiftStartMin: 22 * 60,
        isToday: false,
        nowMinutes: 0,
        insertAfterId: "APT_5A",
        shiftActiveAppts: [
            { appointment_id: "APT_5A", startMin: 22 * 60, duration: 20, status: "SCHEDULED", token_number: "22A" },
            { appointment_id: "APT_5B", startMin: 22 * 60 + 40, duration: 20, status: "SCHEDULED", token_number: "22B" }
        ],
        daySchedules
    });
    strict_1.default.equal(plan.sandwichedStartMin, 22 * 60 + 20, "Sandwiched placed right after 22A at 22:20");
    strict_1.default.equal(plan.sandwichedToken, "22A-1", "Chronological sub-token 22A-1 between 22A and 22B");
    strict_1.default.equal(plan.downstreamUpdates.length, 0, "22B at 22:40 does not overlap 22:20-22:40, so untouched");
}
// 6. Sandwich collision-only ripple-push (when 22B is at 22:20, only 22B shifts to 22:40; later 23:10 is not pulled earlier)
{
    const planCollision = (0, appointment_utils_1.computeSandwichPlan)({
        targetDuration: 20,
        targetToken: "22A",
        shiftStartMin: 22 * 60,
        isToday: false,
        nowMinutes: 0,
        insertAfterId: "APT_5A",
        shiftActiveAppts: [
            { appointment_id: "APT_5A", startMin: 22 * 60, duration: 20, status: "SCHEDULED", token_number: "22A" },
            { appointment_id: "APT_5B", startMin: 22 * 60 + 20, duration: 20, status: "SCHEDULED", token_number: "22B" },
            { appointment_id: "APT_5C", startMin: 23 * 60 + 10, duration: 20, status: "SCHEDULED", token_number: "23A" }
        ],
        daySchedules
    });
    strict_1.default.equal(planCollision.sandwichedStartMin, 22 * 60 + 20);
    strict_1.default.equal(planCollision.sandwichedToken, "22A-1");
    strict_1.default.equal(planCollision.downstreamUpdates.length, 1, "Only overlapping APT_5B shifts; APT_5C at 23:10 is not pulled earlier");
    strict_1.default.equal(planCollision.downstreamUpdates[0].appointment_id, "APT_5B");
    strict_1.default.equal(planCollision.downstreamUpdates[0].newStartMin, 22 * 60 + 40);
}
// 7. Token parsing & natural alphanumeric sort order
{
    const tokens = ["10A", "2A", "1B", "1A-1", "1A", "5B", "5A-1", "5A"];
    const sorted = [...tokens].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    strict_1.default.deepEqual(sorted, ["1A", "1A-1", "1B", "2A", "5A", "5A-1", "5B", "10A"]);
    const parsed = (0, appointment_utils_1.parseHourSlotToken)("5A-1");
    strict_1.default.deepEqual(parsed, { hourIndex: 5, letter: "A", slotIndex: 0, suffix: "1" });
}
// 8. Edit Appointment (APT497 + APT498 till 10:10 AM): rescheduling 40m into 10:00 AM resolves 10:10 AM (no collision)
{
    const res = (0, appointment_utils_1.resolveAppointmentSlotInShift)({
        normRequestedMinutes: 10 * 60, // user picks 10:00 AM - 11:00 AM slot
        shiftStartMin: 9 * 60,
        shiftEndMin: 18 * 60,
        isToday: false,
        nowMinutes: 0,
        durationMinutes: 40,
        sortedIntervals: [
            { start: 9 * 60 + 10, end: 9 * 60 + 30 }, // APT500
            { start: 9 * 60 + 30, end: 9 * 60 + 50 }, // APT499
            { start: 9 * 60 + 50, end: 10 * 60 + 10 } // APT498 ends at 10:10 AM!
        ],
        preserveExactTimeIfFree: false
    });
    strict_1.default.equal(res.calculatedStartMinutes, 10 * 60 + 10, "Must place APT497 at 10:10 AM after APT498");
    strict_1.default.equal(res.dayOffset, 0);
}
// 9. Edit Appointment: rejects both when gap is blocked by later appt AND when exceeding shift end
{
    strict_1.default.throws(() => {
        (0, appointment_utils_1.resolveAppointmentSlotInShift)({
            normRequestedMinutes: 10 * 60,
            shiftStartMin: 9 * 60,
            shiftEndMin: 18 * 60,
            isToday: false,
            nowMinutes: 0,
            durationMinutes: 40,
            sortedIntervals: [
                { start: 9 * 60 + 50, end: 10 * 60 + 30 }, // leaves 30m before 11:00
                { start: 11 * 60, end: 11 * 60 + 20 }
            ],
            preserveExactTimeIfFree: false
        });
    }, /no remaining available time slots/);
    strict_1.default.throws(() => {
        (0, appointment_utils_1.resolveAppointmentSlotInShift)({
            normRequestedMinutes: 10 * 60,
            shiftStartMin: 9 * 60,
            shiftEndMin: 11 * 60, // shift ends at 11:00 -> 30m left
            isToday: false,
            nowMinutes: 0,
            durationMinutes: 40,
            sortedIntervals: [{ start: 9 * 60 + 50, end: 10 * 60 + 30 }],
            preserveExactTimeIfFree: false
        });
    }, /exceeds the available free time/);
}
// 10. Edit Appointment: same-slot metadata edit preserves exact time without pulling into earlier vacant gap
{
    const res = (0, appointment_utils_1.resolveAppointmentSlotInShift)({
        normRequestedMinutes: 10 * 60 + 20, // 10:20 AM preserved even though 10:00-10:20 is free
        shiftStartMin: 9 * 60,
        shiftEndMin: 18 * 60,
        isToday: false,
        nowMinutes: 0,
        durationMinutes: 20,
        sortedIntervals: [],
        preserveExactTimeIfFree: true
    });
    strict_1.default.equal(res.calculatedStartMinutes, 10 * 60 + 20);
    strict_1.default.equal(res.usedExactPreservedTime, true);
}
// 11. Edit Appointment: same-time edit that overlaps an active booking automatically shifts to 10:10 AM
{
    const res = (0, appointment_utils_1.resolveAppointmentSlotInShift)({
        normRequestedMinutes: 10 * 60,
        shiftStartMin: 9 * 60,
        shiftEndMin: 18 * 60,
        isToday: false,
        nowMinutes: 0,
        durationMinutes: 40,
        sortedIntervals: [{ start: 9 * 60 + 50, end: 10 * 60 + 10 }],
        preserveExactTimeIfFree: true
    });
    strict_1.default.equal(res.calculatedStartMinutes, 10 * 60 + 10);
    strict_1.default.equal(res.usedExactPreservedTime, false);
}
// 12. Overnight shift rollover past midnight (22:00 - 02:00)
{
    const res = (0, appointment_utils_1.resolveAppointmentSlotInShift)({
        normRequestedMinutes: 24 * 60, // 00:00 AM next day
        shiftStartMin: 22 * 60,
        shiftEndMin: 26 * 60,
        isToday: false,
        nowMinutes: 0,
        durationMinutes: 20,
        sortedIntervals: [{ start: 23 * 60 + 40, end: 24 * 60 + 20 }], // spills to 00:20 AM
        preserveExactTimeIfFree: false
    });
    strict_1.default.equal(res.calculatedStartMinutes, 24 * 60 + 20); // 00:20 AM
    strict_1.default.equal(res.dayOffset, 1);
}
console.log("ALL 12 APPOINTMENT TOKEN, EDIT & QUEUE INVARIANT TESTS PASSED");
