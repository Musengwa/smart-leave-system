import { LeaveRequest, EmployeeProfile, DecisionResult, DecisionFlag } from "../engine/types";

// ─── Policy Constants ─────────────────────────────────────────────────────────

const PATERNITY_DAYS = 5;
const MUST_BE_TAKEN_WITHIN_DAYS = 30; // must be taken within 30 days of birth

// ─── Module Evaluator ─────────────────────────────────────────────────────────

export function evaluatePaternity(
  request: LeaveRequest,
  employee: EmployeeProfile
): DecisionResult {
  const flags: DecisionFlag[] = [];
  const { daysRequested, isEmergency } = request;
  const balance = employee.leaveBalance.paternity;

  if (isEmergency) flags.push("EMERGENCY_FLAGGED");

  // ── Rule 1: Gender check ──────────────────────────────────────────────────
  if (employee.gender !== "male") {
    flags.push("GENDER_INELIGIBLE");
    return {
      decision: "DENIED",
      module: "paternity",
      reason: "Paternity leave is available to male employees only. Female employees may be eligible for maternity leave.",
      flags,
      canOverride: false,
    };
  }

  // ── Rule 2: Cannot request more than the entitlement ─────────────────────
  if (daysRequested > PATERNITY_DAYS) {
    flags.push("EXCEEDS_SINGLE_REQUEST_LIMIT");
    return {
      decision: "DENIED",
      module: "paternity",
      reason: `Paternity leave is capped at ${PATERNITY_DAYS} working days. You requested ${daysRequested} days. You may combine paternity leave with annual leave if more time is needed.`,
      flags,
      canOverride: true,
      suggestions: [
        `You can take ${PATERNITY_DAYS} paternity days now and apply separately for annual leave to cover the remaining days.`,
      ],
    };
  }

  // ── Rule 3: Balance exhausted ─────────────────────────────────────────────
  if (balance <= 0) {
    flags.push("INSUFFICIENT_BALANCE");
    return {
      decision: "DENIED",
      module: "paternity",
      reason: "Your paternity leave for this year has already been used. Paternity leave is a once-per-year entitlement.",
      flags,
      canOverride: false,
      suggestions: [
        "You may apply for annual leave or discuss unpaid leave options with HR.",
      ],
    };
  }

  // ── All checks passed ─────────────────────────────────────────────────────
  return {
    decision: "APPROVED",
    module: "paternity",
    daysApproved: daysRequested,
    reason: `Your ${daysRequested}-day paternity leave has been approved. Please note that paternity leave must be taken within ${MUST_BE_TAKEN_WITHIN_DAYS} days of the birth of your child.`,
    flags,
    canOverride: false,
    suggestions: [],
  };
}
