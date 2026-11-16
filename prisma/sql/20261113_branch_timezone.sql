-- Branch / hospital timezone columns (IANA zone identifiers).
--
-- Design: store the NAMED IANA zone ("Asia/Kolkata", "America/New_York"),
-- never a fixed offset like "+05:30", so daylight-saving rule changes are
-- followed automatically by every consumer (Intl in Node/browser, AT TIME
-- ZONE in Postgres).
--
--   branch.timezone   authoritative timezone for ALL branch operations:
--                     slot generation, "today" for NO_SHOW sweeps, duty
--                     rosters, chemo day boundaries, UI display.
--   branch.city       city for the worldwide Country -> State -> City
--                     selector (existing `district` doubles as city in the
--                     India-only UI).
--   hospital.timezone org-level fallback only; branch.timezone wins.
--
-- DEFAULT 'Asia/Kolkata' is a migration safety net, not a worldwide
-- assumption: every existing branch is in India, so all existing rows are
-- filled with exactly the hardcoded IST value the code used before, and
-- behaviour is unchanged after applying. Branches created abroad get their
-- zone explicitly from the admin form.
--
-- Re-running this file is safe (IF NOT EXISTS everywhere).

BEGIN;

ALTER TABLE public.branch
    ADD COLUMN IF NOT EXISTS city     VARCHAR(100),
    ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata';

ALTER TABLE public.hospital
    ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) DEFAULT 'Asia/Kolkata';

-- Sanity guard: the column must hold a zone identifier, not a free-form
-- string. Allows "UTC", "Asia/Kolkata", "America/Argentina/Buenos_Aires",
-- "Etc/GMT+5" -- i.e. optional path segments, digits, _, + and -.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'chk_branch_timezone_iana'
           AND conrelid = 'public.branch'::regclass
    ) THEN
        ALTER TABLE public.branch
            ADD CONSTRAINT chk_branch_timezone_iana
            CHECK (timezone ~ '^[A-Za-z][A-Za-z0-9_+-]*(/[A-Za-z0-9_+-]+)*$');
    END IF;
END $$;

COMMIT;

-- Verify:
--   SELECT branch_id, branch_name, city, timezone FROM public.branch;
--   SELECT hospital_id, hospital_name, timezone FROM public.hospital;
