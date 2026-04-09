-- ─── LeaveAI Supabase Schema ──────────────────────────────────────────────────
-- Run this in your Supabase SQL editor (Database → SQL Editor → New Query)
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── EMPLOYEES ────────────────────────────────────────────────────────────────

create table employees (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  email            text unique not null,
  gender           text check (gender in ('male', 'female', 'other')) not null,
  job_title        text,
  department       text,

  -- Calculated from hire_date at query time, but stored for convenience
  hire_date        date not null,
  months_worked    int generated always as (
    (extract(year from age(current_date, hire_date)) * 12 +
     extract(month from age(current_date, hire_date)))::int
  ) stored,

  -- Leave balances for the current leave year
  -- These get reset annually via a scheduled Supabase function (see below)
  balance_annual        int not null default 24,
  balance_sick          int not null default 26,
  balance_maternity     int not null default 84,
  balance_paternity     int not null default 5,
  balance_compassionate int not null default 5,
  balance_study         int not null default 30,

  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- Auto-update updated_at on any row change
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger employees_updated_at
  before update on employees
  for each row execute function update_updated_at();


-- ─── LEAVE RECORDS ────────────────────────────────────────────────────────────

create table leave_records (
  id               uuid primary key default gen_random_uuid(),
  employee_id      uuid not null references employees(id) on delete cascade,

  -- The original form submission (stored as JSON)
  request          jsonb not null,

  -- The engine's initial decision (stored as JSON — matches DecisionResult type)
  decision         jsonb not null,

  -- The final outcome after chat — may differ from initial decision
  -- NULL means the chat is still in progress
  final_decision   text check (
    final_decision in ('APPROVED', 'DENIED', 'REFER_HR', 'PENDING_INFO')
  ),

  -- Full chat transcript stored as a JSON array of {role, content} objects
  chat_transcript  jsonb default '[]'::jsonb,

  -- Convenience columns pulled out of the request JSON for easy querying
  -- (avoids having to dig into JSONB for common filters)
  leave_type       text not null check (
    leave_type in ('annual', 'sick', 'maternity', 'paternity', 'compassionate', 'study')
  ),
  days_requested   int not null,
  days_approved    int,              -- null if denied or referred
  start_date       date not null,

  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create trigger leave_records_updated_at
  before update on leave_records
  for each row execute function update_updated_at();

-- Index for fast employee history lookups
create index leave_records_employee_id_idx on leave_records(employee_id);
create index leave_records_leave_type_idx  on leave_records(leave_type);
create index leave_records_created_at_idx  on leave_records(created_at desc);


-- ─── ANNUAL LEAVE RESET (Scheduled Function) ──────────────────────────────────
-- This resets all employee leave balances on Jan 1st each year.
-- To activate: go to Supabase → Database → Functions, then set up a cron
-- job via pg_cron: 0 0 1 1 * (midnight on January 1st)

create or replace function reset_annual_leave_balances()
returns void as $$
begin
  update employees set
    balance_annual        = 24,
    balance_sick          = 26,
    balance_maternity     = 84,
    balance_paternity     = 5,
    balance_compassionate = 5,
    balance_study         = 30;
end;
$$ language plpgsql;

-- To schedule (run this once in SQL editor after enabling pg_cron extension):
-- select cron.schedule('reset-leave-balances', '0 0 1 1 *', 'select reset_annual_leave_balances()');


-- ─── DEDUCT BALANCE FUNCTION ──────────────────────────────────────────────────
-- Called after a leave is APPROVED to deduct days from the employee's balance.
-- The API route calls this via supabase.rpc('deduct_leave_balance', {...})

create or replace function deduct_leave_balance(
  p_employee_id uuid,
  p_leave_type  text,
  p_days        int
)
returns void as $$
begin
  execute format(
    'update employees set balance_%I = balance_%I - $1 where id = $2',
    p_leave_type, p_leave_type
  ) using p_days, p_employee_id;
end;
$$ language plpgsql;


-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
-- Employees can only read their own records.
-- Service role (used by your Node backend) bypasses RLS entirely.

alter table employees    enable row level security;
alter table leave_records enable row level security;

-- Employees table: read own row only
create policy "employees_read_own"
  on employees for select
  using (auth.uid()::text = id::text);

-- Leave records: read own records only
create policy "leave_records_read_own"
  on leave_records for select
  using (auth.uid()::text = employee_id::text);

-- Leave records: insert own records only
create policy "leave_records_insert_own"
  on leave_records for insert
  with check (auth.uid()::text = employee_id::text);

-- Leave records: update own records only
create policy "leave_records_update_own"
  on leave_records for update
  using (auth.uid()::text = employee_id::text);


-- ─── SAMPLE DATA (optional, for testing) ──────────────────────────────────────
-- Remove before going to production

insert into employees (name, email, gender, job_title, department, hire_date) values
  ('Chanda Mwamba',   'chanda@company.zm',   'female', 'Software Engineer', 'Technology',  '2022-03-15'),
  ('Bwalya Mutale',   'bwalya@company.zm',   'male',   'HR Manager',        'HR',          '2020-06-01'),
  ('Mutinta Hachipuka','mutinta@company.zm', 'female', 'Accountant',        'Finance',     '2023-09-10');
