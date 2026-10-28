ALTER TABLE public.pharmacy_slip
    ADD COLUMN IF NOT EXISTS amend_count        INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_amended_at    TIMESTAMP(6),
    ADD COLUMN IF NOT EXISTS last_amended_by    VARCHAR(100),
    ADD COLUMN IF NOT EXISTS last_amend_reason  VARCHAR(500);

