import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import prisma from "./src/config/prisma";

// Repair script for the 2026-08-18 doctor-transfer data corruption.
//
// WHAT IT REPAIRS (DOC035 only, evidence-driven):
//   1. Schedule rows that existed BEFORE the transfer chaos started
//      (created before 2026-08-18 06:57:44 UTC) and were silently closed
//      during it, provided no equivalent active row exists today
//      (same branch + day + time). These were destroyed by the old
//      "silently close conflicting schedules" behavior.
//   2. Branch mappings whose branch now has active schedules again but no
//      active mapping — so the doctor's assignment list matches reality.
//
// SAFETY:
//   - Dry-run by default: prints exactly what would change, changes nothing.
//   - Pass --apply to actually write. A full JSON backup of every touched
//     row (and the doctor's complete mapping/schedule state) is written to
//     a file BEFORE anything is modified.
//   - Never deletes rows. History is preserved.
//   - Never creates duplicates: a row/mapping is only restored when no
//     active equivalent already exists.

const TARGET_ID = process.env.REPAIR_TARGET_ID ?? "DOC035";

// The moment the transfer chaos started (first wrongful close on 08-18).
const CHAOS_START = new Date("2026-08-18T06:57:44.599Z");

const APPLY = process.argv.includes("--apply");

function fmtTime(value: Date | null): string | null {
  if (!value) return null;
  return `${String(value.getUTCHours()).padStart(2, "0")}:${String(value.getUTCMinutes()).padStart(2, "0")}`;
}

function timeToMinutes(value: Date | null): number {
  if (!value) return -1;
  return value.getUTCHours() * 60 + value.getUTCMinutes();
}

function sameSlot(a: { start_time: Date | null; end_time: Date | null }, b: { start_time: Date | null; end_time: Date | null }) {
  return timeToMinutes(a.start_time) === timeToMinutes(b.start_time) && timeToMinutes(a.end_time) === timeToMinutes(b.end_time);
}

async function collectBackup(employeeId: string) {
  return {
    employee: await prisma.employees.findUnique({
      where: { employee_id: employeeId },
      select: { employee_id: true, user_id: true, branch_id: true, emp_status: true },
    }),
    mappings: await prisma.user_branch_mapping.findMany({
      where: { employee_id: employeeId },
      orderBy: { id: "asc" },
    }),
    schedules: await prisma.doctor_schedule.findMany({
      where: { employee_id: employeeId },
      orderBy: { schedule_id: "asc" },
    }),
  };
}

async function main() {
  console.log(`\n=== Doctor transfer data repair ===`);
  console.log(`Target : ${TARGET_ID}`);
  console.log(`Mode   : ${APPLY ? "APPLY (--apply)" : "DRY-RUN (no changes)"}`);
  console.log(`Chaos  : rows created before ${CHAOS_START.toISOString()} are considered "pre-existing"\n`);

  const backup = await collectBackup(TARGET_ID);
  if (!backup.employee) {
    console.error(`FAILED: employee ${TARGET_ID} not found`);
    process.exit(1);
  }
  console.log(
    `Doctor : ${backup.employee.employee_id} (user ${backup.employee.user_id}, employees.branch_id = ${backup.employee.branch_id})`,
  );

  const activeSchedules = backup.schedules.filter((s) => s.is_active);
  const activeMappings = backup.mappings.filter((m) => m.status === 1);

  // ── 1. Restore pre-chaos schedules that were silently closed ──
  const restorableSchedules = backup.schedules.filter((s) => {
    if (s.is_active) return false;
    if (s.created_at.getTime() >= CHAOS_START.getTime()) return false;

    // No active equivalent today (same branch + day + overlapping-cover check
    // is deliberately strict: exact same branch/day/time, or an active row
    // whose hours fully cover this one).
    const activeEquivalent = activeSchedules.some(
      (a) =>
        a.branch_id === s.branch_id &&
        (a.day_of_week ?? "").toUpperCase() === (s.day_of_week ?? "").toUpperCase() &&
        sameSlot(a, s),
    );
    if (activeEquivalent) return false;

    const activeCovering = activeSchedules.some(
      (a) =>
        a.branch_id === s.branch_id &&
        (a.day_of_week ?? "").toUpperCase() === (s.day_of_week ?? "").toUpperCase() &&
        timeToMinutes(a.start_time) <= timeToMinutes(s.start_time) &&
        timeToMinutes(a.end_time) >= timeToMinutes(s.end_time),
    );
    return !activeCovering;
  });

  // ── 2. Restore mappings for branches that regained schedules ──
  // Only ONE mapping per branch — the original (earliest id) row. Duplicate
  // rows left behind by transfer cycles stay closed (history preserved).
  const restoredBranches = new Set(restorableSchedules.map((s) => s.branch_id));
  const restorableMappings = Array.from(
    backup.mappings
      .filter((m) => m.status === 0 && restoredBranches.has(m.branch_id))
      .filter((m) => !activeMappings.some((a) => a.branch_id === m.branch_id))
      .reduce((byBranch, m) => {
        if (!byBranch.has(m.branch_id)) byBranch.set(m.branch_id, m);
        return byBranch;
      }, new Map<string, (typeof backup.mappings)[number]>())
      .values(),
  );

  console.log(`\n--- Plan ---`);
  for (const s of restorableSchedules) {
    console.log(
      `  RESTORE schedule ${String(s.schedule_id)}  ${s.branch_id}  ${s.day_of_week}  ${fmtTime(s.start_time)}–${fmtTime(s.end_time)}  (closed at ${s.effective_to?.toISOString() ?? "?"}, was pre-chaos)`,
    );
  }
  for (const m of restorableMappings) {
    console.log(
      `  RESTORE mapping  ${String(m.id)}  ${m.branch_id}  (closed at ${m.effective_to?.toISOString() ?? "?"}, originally assigned ${m.assigned_date.toISOString()})`,
    );
  }
  if (restorableSchedules.length === 0 && restorableMappings.length === 0) {
    console.log("  Nothing to restore — data is already consistent.");
  }

  if (!APPLY) {
    console.log(`\nDry-run complete. Re-run with --apply to write these changes.`);
    await prisma.$disconnect();
    return;
  }

  // ── Backup before touching anything ──
  const backupPath = path.join(process.cwd(), `repair-backup-${TARGET_ID}-${Date.now()}.json`);
  const bigintSafe = (key: string, value: unknown) => (typeof value === "bigint" ? value.toString() : value);
  fs.writeFileSync(backupPath, JSON.stringify(backup, bigintSafe, 2), "utf8");
  console.log(`\nBackup written to ${backupPath}`);

  // ── Apply ──
  let restoredSchedules = 0;
  for (const s of restorableSchedules) {
    await prisma.doctor_schedule.update({
      where: { schedule_id: s.schedule_id },
      data: { is_active: true, effective_to: null },
    });
    restoredSchedules += 1;
  }

  let restoredMappings = 0;
  for (const m of restorableMappings) {
    await prisma.user_branch_mapping.update({
      where: { id: m.id },
      data: { status: 1, effective_to: null },
    });
    restoredMappings += 1;
  }

  console.log(`\nDone: restored ${restoredSchedules} schedule row(s) and ${restoredMappings} mapping row(s).`);
  console.log(`Nothing was deleted — all history remains intact.\n`);

  const after = await collectBackup(TARGET_ID);
  console.log(
    "Post-state — active schedules:",
    after.schedules.filter((s) => s.is_active).map((s) => `${s.branch_id} ${s.day_of_week} ${fmtTime(s.start_time)}–${fmtTime(s.end_time)}`),
  );
  console.log(
    "Post-state — active mappings:",
    after.mappings.filter((m) => m.status === 1).map((m) => m.branch_id),
  );

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("FAILED:", e);
  await prisma.$disconnect();
  process.exit(1);
});