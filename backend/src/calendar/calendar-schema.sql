-- ─── LeaveAI Calendar Schema ──────────────────────────────────────────────────
-- Run this in Supabase SQL Editor after the main schema.sql
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── PUBLIC HOLIDAYS ─────────────────────────────────────────────────────────
-- Pre-loaded with Zambian public holidays. HR can add/remove via the HR app.

create table public_holidays (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  date        date not null unique,
  is_recurring boolean default true, -- true = repeats every year on same date
  created_at  timestamptz default now()
);

-- Zambian public holidays (Employment Code Act + statutory holidays)
insert into public_holidays (name, date, is_recurring) values
  ('New Year''s Day',              '2025-01-01', true),
  ('International Women''s Day',   '2025-03-08', true),
  ('Youth Day',                    '2025-03-12', true),
  ('Good Friday',                  '2025-04-18', false), -- changes yearly
  ('Holy Saturday',                '2025-04-19', false),
  ('Easter Monday',                '2025-04-21', false),
  ('Labour Day',                   '2025-05-01', true),
  ('Africa Freedom Day',           '2025-05-25', true),
  ('Heroes'' Day',                  '2025-07-07', false), -- first Monday July
  ('Unity Day',                    '2025-07-08', false), -- first Tuesday July
  ('Farmers'' Day',                 '2025-08-04', false), -- first Monday August
  ('National Day of Prayer',       '2025-10-18', true),
  ('Independence Day',             '2025-10-24', true),
  ('Christmas Day',                '2025-12-25', true),
  ('Boxing Day',                   '2025-12-26', true);


-- ─── BLACKOUT PERIODS ────────────────────────────────────────────────────────
-- Periods where leave is restricted. HR adds these via the HR management app.

create table blackout_periods (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,                    -- e.g. "Month-end Reporting"
  description   text,                             -- more detail for the AI to use
  start_date    date not null,
  end_date      date not null,
  department    text default 'ALL',               -- 'ALL' or specific dept name
  severity      text check (
    severity in ('soft', 'hard')
  ) default 'hard',
  -- soft = AI discourages but engine still approves
  -- hard = REFER_HR, strongly discourage
  created_by    uuid references employees(id),
  created_at    timestamptz default now(),
  
  constraint valid_date_range check (end_date >= start_date)
);

-- Sample blackout periods
insert into blackout_periods (title, description, start_date, end_date, department, severity) values
  ('Month-end Reporting', 'Financial close period — all departments required', '2025-07-28', '2025-07-31', 'ALL', 'hard'),
  ('Annual Audit', 'External audit period — Finance and HR restricted', '2025-09-01', '2025-09-15', 'Finance', 'hard'),
  ('Peak Season', 'High workload period — leave discouraged', '2025-12-01', '2025-12-24', 'ALL', 'soft');


-- ─── INDEXES ─────────────────────────────────────────────────────────────────

create index blackout_periods_dates_idx on blackout_periods(start_date, end_date);
create index public_holidays_date_idx   on public_holidays(date);


-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Both tables are readable by everyone (backend service role)
-- Only HR can insert/update/delete (handled by HR app)

alter table public_holidays   enable row level security;
alter table blackout_periods  enable row level security;

create policy "public_holidays_read_all"
  on public_holidays for select using (true);

create policy "blackout_periods_read_all"
  on blackout_periods for select using (true);
