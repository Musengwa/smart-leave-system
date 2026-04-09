import { LeaveRequest, EmployeeProfile, DecisionResult, DecisionFlag } from "../engine/types";

// ─── Policy Constants ─────────────────────────────────────────────────────────

const STUDY_DAYS_PER_YEAR = 30;
const MIN_SERVICE_MONTHS = 12;   // at least 1 year before study leave is considered

// ─── Module Evaluator ─────────────────────────────────────────────────────────

export function evaluateStudy(
  request: LeaveRequest,
  employee: EmployeeProfile
): DecisionResult {
  const flags: DecisionFlag[] = [];
  const { daysRequested } = request;

  // ── Rule 1: Minimum service — not worth referring if they just started ────
  if (employee.monthsWorked < MIN_SERVICE_MONTHS) {
    flags.push("INSUFFICIENT_SERVICE");
    return {
      decision: "DENIED",
      module: "study",
      reason: `Study leave requires a minimum of 1 year of service. You have ${employee.monthsWorked} month(s) of service. You will be eligible to apply after ${MIN_SERVICE_MONTHS - employee.monthsWorked} more month(s).`,
      flags,
      canOverride: false,
    };
  }

  // ── Rule 2: Exceeds annual study leave cap ────────────────────────────────
  if (daysRequested > STUDY_DAYS_PER_YEAR) {
    flags.push("EXCEEDS_SINGLE_REQUEST_LIMIT");
    return {
      decision: "DENIED",
      module: "study",
      reason: `Study leave is capped at ${STUDY_DAYS_PER_YEAR} days per year. You requested ${daysRequested} days. Please revise your request and resubmit.`,
      flags,
      canOverride: true,
      suggestions: [
        `You can request up to ${STUDY_DAYS_PER_YEAR} study days per year.`,
        "If your course requires more time, discuss a longer arrangement directly with HR.",
      ],
    };
  }

  // ── Rule 3: All study leave goes to HR — it requires documentation ────────
  // Study leave needs: institution letter, course details, exam timetable,
  // and management sign-off that the role can be covered.
  flags.push("REQUIRES_DOCUMENTATION");
  return {
    decision: "REFER_HR",
    module: "study",
    reason: `Your request for ${daysRequested} days of study leave has been received. Study leave must be approved by HR and your line manager. You meet the service requirement, so your application will be considered.`,
    flags,
    canOverride: false,
    suggestions: [
      "Prepare a letter from your educational institution confirming enrollment and exam dates.",
      "Provide your course timetable and the relevance of the course to your role.",
      "Submit your application at least 2 weeks before the leave start date.",
    ],
  };
}
