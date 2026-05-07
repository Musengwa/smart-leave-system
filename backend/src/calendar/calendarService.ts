import { createClient } from "@supabase/supabase-js";

// Uses the same Supabase instance as the rest of the backend
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type CoverageRisk = "low" | "medium" | "high";

export interface BlackoutPeriod {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  department: string;
  severity: "soft" | "hard";
}

export interface CalendarCheckResult {
  // Blackout
  isBlackedOut: boolean;
  blackoutSeverity: "soft" | "hard" | null;
  blackoutReason: string | null;       // e.g. "Month-end Reporting (Jul 28–31)"
  blackoutDescription: string | null;  // extra detail for AI to use

  // Team coverage
  teamOnLeave: number;                 // how many teammates already on leave
  coverageRisk: CoverageRisk;
  coverageMessage: string;

  // Public holidays
  publicHolidays: string[];            // names of holidays in the range
  adjustedDays: number;                // requested days minus public holidays

  // Overall flags for the engine
  shouldReferHR: boolean;              // true if hard blackout or high coverage risk
  flags: CalendarFlag[];
}

export type CalendarFlag =
  | "BLACKOUT_HARD"         // hard blackout — REFER_HR
  | "BLACKOUT_SOFT"         // soft blackout — approve but discourage
  | "HIGH_TEAM_CONFLICT"    // too many people off — REFER_HR
  | "MEDIUM_TEAM_CONFLICT"  // some people off — warn in chat
  | "CONTAINS_PUBLIC_HOLIDAYS" // holidays found, days adjusted
  | "FULL_PERIOD_IS_HOLIDAYS"; // entire period is holidays

// ─── Team coverage thresholds ─────────────────────────────────────────────────

const COVERAGE_THRESHOLDS = {
  high:   3,  // 3+ people on leave → REFER_HR
  medium: 1,  // 1-2 people on leave → warn in chat
};

// ─── Main Calendar Check ──────────────────────────────────────────────────────

export async function checkCalendar(
  startDate: string,
  endDate: string,
  employeeId: string,
  department?: string
): Promise<CalendarCheckResult> {

  const [blackout, holidays, teamCount] = await Promise.all([
    checkBlackoutPeriods(startDate, endDate, department),
    getPublicHolidaysInRange(startDate, endDate),
    getTeamOnLeaveCount(startDate, endDate, employeeId),
  ]);

  const requestedDays = calculateWorkingDays(startDate, endDate);
  const adjustedDays  = Math.max(0, requestedDays - holidays.length);
  const flags: CalendarFlag[] = [];

  // ── Blackout flags ────────────────────────────────────────────────────────
  if (blackout) {
    flags.push(blackout.severity === "hard" ? "BLACKOUT_HARD" : "BLACKOUT_SOFT");
  }

  // ── Coverage flags ────────────────────────────────────────────────────────
  let coverageRisk: CoverageRisk = "low";
  let coverageMessage = "Team coverage looks good for these dates.";

  if (teamCount >= COVERAGE_THRESHOLDS.high) {
    coverageRisk = "high";
    coverageMessage = `${teamCount} team members are already on leave during this period. Approving this request would leave the team critically understaffed.`;
    flags.push("HIGH_TEAM_CONFLICT");
  } else if (teamCount >= COVERAGE_THRESHOLDS.medium) {
    coverageRisk = "medium";
    coverageMessage = `${teamCount} team member(s) are already on leave during part of this period. Coverage will be reduced but manageable.`;
    flags.push("MEDIUM_TEAM_CONFLICT");
  }

  // ── Holiday flags ─────────────────────────────────────────────────────────
  if (holidays.length > 0) {
    flags.push("CONTAINS_PUBLIC_HOLIDAYS");
    if (adjustedDays === 0) flags.push("FULL_PERIOD_IS_HOLIDAYS");
  }

  // ── Should refer to HR? ───────────────────────────────────────────────────
  const shouldReferHR =
    (blackout?.severity === "hard") ||
    (coverageRisk === "high");

  return {
    isBlackedOut:        !!blackout,
    blackoutSeverity:    blackout?.severity ?? null,
    blackoutReason:      blackout ? `${blackout.title} (${formatDateRange(blackout.start_date, blackout.end_date)})` : null,
    blackoutDescription: blackout?.description ?? null,
    teamOnLeave:         teamCount,
    coverageRisk,
    coverageMessage,
    publicHolidays:      holidays,
    adjustedDays,
    shouldReferHR,
    flags,
  };
}

// ─── Check blackout periods ───────────────────────────────────────────────────

async function checkBlackoutPeriods(
  startDate: string,
  endDate: string,
  department?: string
): Promise<BlackoutPeriod | null> {

  // Find any blackout period that overlaps with the requested dates
  // A blackout overlaps if: blackout_start <= endDate AND blackout_end >= startDate
  let query = supabase
    .from("blackout_periods")
    .select("*")
    .lte("start_date", endDate)
    .gte("end_date", startDate)
    .order("severity", { ascending: false }); // hard blackouts first

  const { data, error } = await query;
  if (error || !data || data.length === 0) return null;

  // Filter by department — 'ALL' applies to everyone
  const relevant = data.filter(
    (b) => b.department === "ALL" || b.department === department
  );

  if (relevant.length === 0) return null;

  // Return the most severe one (hard > soft)
  return relevant.find(b => b.severity === "hard") ?? relevant[0];
}

// ─── Get public holidays in date range ───────────────────────────────────────

async function getPublicHolidaysInRange(
  startDate: string,
  endDate: string
): Promise<string[]> {

  const { data, error } = await supabase
    .from("public_holidays")
    .select("name, date")
    .gte("date", startDate)
    .lte("date", endDate);

  if (error || !data) return [];

  // For recurring holidays, also check if this year's version falls in range
  // (since they're stored with a fixed year in the DB)
  const currentYear = new Date(startDate).getFullYear();
  const start = new Date(startDate);
  const end   = new Date(endDate);

  const { data: recurring } = await supabase
    .from("public_holidays")
    .select("name, date")
    .eq("is_recurring", true);

  const recurringThisYear = (recurring ?? []).filter(h => {
    const originalDate = new Date(h.date);
    const thisYearDate = new Date(currentYear, originalDate.getMonth(), originalDate.getDate());
    return thisYearDate >= start && thisYearDate <= end;
  }).map(h => h.name);

  // Merge and deduplicate
  const fromDB = data.map(h => h.name);
  return [...new Set([...fromDB, ...recurringThisYear])];
}

// ─── Count teammates on leave during the requested period ─────────────────────

async function getTeamOnLeaveCount(
  startDate: string,
  endDate: string,
  employeeId: string
): Promise<number> {

  // Find approved leave records that overlap with the requested dates
  // excluding the requesting employee
  const { data, error } = await supabase
    .from("leave_records")
    .select("id")
    .neq("employee_id", employeeId)
    .in("final_decision", ["APPROVED"])
    .lte("start_date", endDate)
    .gte("start_date", startDate); // simplified overlap check

  if (error || !data) return 0;
  return data.length;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calculateWorkingDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end   = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en-US", opts)}–${e.toLocaleDateString("en-US", opts)}`;
}
