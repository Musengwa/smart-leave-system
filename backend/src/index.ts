import { LeaveRequest, EmployeeProfile, DecisionResult, LeaveType } from "./types";
import { evaluateAnnual }       from "../modules/annual";
import { evaluateSick }         from "../modules/sick";
import { evaluateMaternity }    from "../modules/maternity";
import { evaluatePaternity }    from "../modules/paternity";
import { evaluateCompassionate} from "../modules/compassionate";
import { evaluateStudy }        from "../modules/study";
import { checkCalendar, CalendarCheckResult } from "../calendar/calendarService";

// ─── Module Registry ──────────────────────────────────────────────────────────

type ModuleEvaluator = (
  request: LeaveRequest,
  employee: EmployeeProfile
) => DecisionResult;

const moduleRegistry: Record<LeaveType, ModuleEvaluator | null> = {
  annual:        evaluateAnnual,
  sick:          evaluateSick,
  maternity:     evaluateMaternity,
  paternity:     evaluatePaternity,
  compassionate: evaluateCompassionate,
  study:         evaluateStudy,
};

// ─── Main Engine Entry Point ──────────────────────────────────────────────────

export async function runDecisionEngine(
  request: LeaveRequest,
  employee: EmployeeProfile
): Promise<DecisionResult> {

  const evaluator = moduleRegistry[request.leaveType];

  // Guard: module not built yet
  if (!evaluator) {
    return {
      decision: "REFER_HR",
      module: request.leaveType,
      reason: `The ${request.leaveType} leave module is not yet configured. Please contact HR directly.`,
      flags: [],
      canOverride: false,
    };
  }

  // Guard: basic sanity checks
  const sanityCheck = runSanityChecks(request);
  if (sanityCheck) return { ...sanityCheck, module: request.leaveType };

  // ── Step 1: Run the leave module ─────────────────────────────────────────
  const moduleResult = evaluator(request, employee);

  // If module already refers to HR, no need to check calendar
  if (moduleResult.decision === "REFER_HR") {
    moduleResult.canOverride = false;
    return moduleResult;
  }

  // ── Step 2: Run the calendar check ───────────────────────────────────────
  const calendar = await checkCalendar(
    request.startDate,
    request.endDate,
    employee.id,
    employee.department
  );

  // Merge calendar result into the module result
  return applyCalendarResult(moduleResult, calendar, request);
}

// ─── Apply calendar check to module result ────────────────────────────────────

function applyCalendarResult(
  moduleResult: DecisionResult,
  calendar: CalendarCheckResult,
  request: LeaveRequest
): DecisionResult {

  const mergedFlags = [...moduleResult.flags, ...calendar.flags] as any[];
  const suggestions = [...(moduleResult.suggestions ?? [])];

  // ── Case 1: Hard blackout or high team conflict → REFER_HR ───────────────
  if (calendar.shouldReferHR) {
    let reason = "";

    if (calendar.isBlackedOut && calendar.blackoutSeverity === "hard") {
      reason = `Your requested dates fall within a restricted period: ${calendar.blackoutReason}. ${calendar.blackoutDescription ?? ""} Leave during this period requires HR approval and is strongly discouraged.`;
    } else if (calendar.coverageRisk === "high") {
      reason = `${calendar.coverageMessage} This level of team absence requires HR sign-off.`;
    }

    // Suggest nearest available window
    suggestions.push(
      "Consider requesting dates outside the restricted period.",
      "Contact HR to discuss if an exception can be made for your circumstances."
    );

    return {
      ...moduleResult,
      decision: "REFER_HR",
      reason,
      flags: mergedFlags,
      canOverride: false,
      suggestions,
      calendarResult: calendar,
    };
  }

  // ── Case 2: Soft blackout → approve but add strong warning ───────────────
  if (calendar.isBlackedOut && calendar.blackoutSeverity === "soft") {
    suggestions.push(
      `Note: Your dates overlap with ${calendar.blackoutReason}. While your leave can be approved, this is a busy period and your manager may request you to adjust your dates.`
    );
  }

  // ── Case 3: Medium team conflict → approve with warning ──────────────────
  if (calendar.coverageRisk === "medium") {
    suggestions.push(calendar.coverageMessage);
  }

  // ── Case 4: Public holidays → adjust days and inform ─────────────────────
  if (calendar.publicHolidays.length > 0) {
    const holidayList = calendar.publicHolidays.join(", ");

    if (calendar.adjustedDays === 0) {
      // Entire period is public holidays — no leave days needed
      return {
        ...moduleResult,
        decision: "APPROVED",
        daysApproved: 0,
        reason: `Your requested period falls entirely on public holidays (${holidayList}). No leave days will be deducted.`,
        flags: mergedFlags,
        canOverride: false,
        suggestions,
        calendarResult: calendar,
      };
    }

    // Partial holidays — adjust days approved
    const holidayNote = `Your period includes ${calendar.publicHolidays.length} public holiday(s) (${holidayList}), so only ${calendar.adjustedDays} leave days will be deducted instead of ${request.daysRequested}.`;
    suggestions.push(holidayNote);

    return {
      ...moduleResult,
      daysApproved: calendar.adjustedDays,
      reason: moduleResult.reason + ` ${holidayNote}`,
      flags: mergedFlags,
      suggestions,
      calendarResult: calendar,
    };
  }

  // ── No calendar issues — return module result with any warnings merged ───
  return {
    ...moduleResult,
    flags: mergedFlags,
    suggestions,
    calendarResult: calendar,
  };
}

// ─── Sanity Checks ────────────────────────────────────────────────────────────

function runSanityChecks(
  request: LeaveRequest
): Omit<DecisionResult, "module"> | null {
  if (request.daysRequested <= 0) {
    return {
      decision: "DENIED",
      reason: "Days requested must be greater than zero.",
      flags: [],
      canOverride: false,
    };
  }
  if (request.daysRequested > 365) {
    return {
      decision: "DENIED",
      reason: "A single leave request cannot exceed 365 days.",
      flags: [],
      canOverride: false,
    };
  }
  return null;
}
