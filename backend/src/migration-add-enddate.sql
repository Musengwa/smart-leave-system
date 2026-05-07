-- ─── Migration: add end_date to leave_records ────────────────────────────────
-- Run this in Supabase SQL Editor

alter table leave_records
  add column if not exists end_date date;

-- Backfill existing rows with start_date as fallback
update leave_records set end_date = start_date where end_date is null;
