import prisma from "../config/prisma";

// ---------------------------------------------------------------------------
// Single source of truth for timezone handling in the backend.
//
// The hospital operates on IANA zone identifiers stored per branch
// (branch.timezone, e.g. "Asia/Kolkata", "America/New_York") - NEVER a fixed
// offset, so daylight-saving rule changes are followed automatically.
//
// Everything here resolves "today"/"now" through Intl, so results depend only
// on the given zone - never on the host server timezone (local dev vs Vercel
// vs Supabase pg_cron all behave identically).
// ---------------------------------------------------------------------------

/** Fallback zone for missing/invalid branch rows (matches the DB default). */
export const DEFAULT_TIMEZONE = "Asia/Kolkata";

/** Legacy fixed IST offset (+05:30, no DST). Kept for existing call sites that
 *  deliberately want IST regardless of branch; prefer getTodayIn(tz) instead. */
export const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/** True when `tz` is a zone Intl (and therefore Node/browsers/Postgres) knows. */
export function isValidTimeZone(tz: unknown): tz is string {
    if (typeof tz !== "string" || tz.length === 0 || tz.length > 64) return false;
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}

/** Always returns a usable zone: the value when valid, else DEFAULT_TIMEZONE. */
export function safeTimeZone(tz?: string | null): string {
    return isValidTimeZone(tz) ? tz : DEFAULT_TIMEZONE;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Wall-clock fields of `date` as seen in `tz`. */
function zonedParts(tz: string, date: Date) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    }).formatToParts(date);

    const num = (type: Intl.DateTimeFormatPartTypes) =>
        Number(parts.find((p) => p.type === type)?.value ?? 0);

    return {
        year: num("year"),
        month: num("month"),
        day: num("day"),
        hour: num("hour"),
        minute: num("minute"),
        second: num("second"),
    };
}

/**
 * Offset (ms) of `tz` from UTC at the given instant - DST-aware, recomputed
 * every call (a zone's offset differs in summer vs winter).
 */
export function getTimezoneOffsetMs(tz: string, date: Date = new Date()): number {
    const p = zonedParts(safeTimeZone(tz), date);
    const asUtc = Date.UTC(
        p.year,
        p.month - 1,
        p.day,
        p.hour,
        p.minute,
        p.second,
        date.getUTCMilliseconds()
    );
    return asUtc - date.getTime();
}

/**
 * "Now" shifted so its UTC getters read the wall clock in `tz` - the exact
 * pattern the old getNowInIST() used, now zone-driven. Reading it with
 * getUTC*() therefore yields local-in-tz fields.
 */
export function getNowIn(tz: string): Date {
    const now = new Date();
    return new Date(now.getTime() + getTimezoneOffsetMs(tz, now));
}

/** The calendar day `date` falls on in `tz`, as "YYYY-MM-DD". */
export function getDateIn(tz: string, date: Date): string {
    const p = zonedParts(safeTimeZone(tz), date);
    return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** "YYYY-MM-DD" for the current calendar day in `tz` (for @db.Date columns). */
export function getTodayIn(tz: string): string {
    return getDateIn(tz, new Date());
}

/** Minutes since local midnight in `tz` (0..1439) - for slot/"is now past" checks. */
export function getNowMinutesIn(tz: string): number {
    const p = zonedParts(safeTimeZone(tz), new Date());
    return p.hour * 60 + p.minute;
}

// ---------------------------------------------------------------------------
// Branch -> timezone resolution (cached; a branch's zone changes rarely).
// ---------------------------------------------------------------------------

const TZ_CACHE_TTL_MS = 5 * 60 * 1000;
const branchTzCache = new Map<string, { tz: string; at: number }>();

/**
 * The authoritative timezone for a branch. Falls back to DEFAULT_TIMEZONE
 * when the branch is unknown or its row carries an invalid zone, so a bad
 * row can never crash a request or a job.
 */
export async function getBranchTimezone(branchId?: string | null): Promise<string> {
    if (!branchId) return DEFAULT_TIMEZONE;

    const hit = branchTzCache.get(branchId);
    if (hit && Date.now() - hit.at < TZ_CACHE_TTL_MS) return hit.tz;

    let tz = DEFAULT_TIMEZONE;
    try {
        const row = await prisma.branch.findUnique({
            where: { branch_id: branchId },
            select: { timezone: true },
        });
        if (row) tz = safeTimeZone(row.timezone);
    } catch {
        // fail closed to the default rather than throwing mid-request/job
        tz = DEFAULT_TIMEZONE;
    }

    branchTzCache.set(branchId, { tz, at: Date.now() });
    return tz;
}

/** Call after an admin edits branch.timezone so the next read is fresh. */
export function invalidateBranchTimezone(branchId: string): void {
    branchTzCache.delete(branchId);
}
