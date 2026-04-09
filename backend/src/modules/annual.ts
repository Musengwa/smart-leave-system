 import { LeaveRequest, EmployeeProfile, DecisionResult, DecisionFlag } from "../engine/types";

// ─── Policy Constants (Employment Code Act No. 3 of 2019, S.56) ──────────────

const ANNUAL_DAYS_PER_YEAR = 24;
const ACCRUAL_PER_MONTH = 2;            // days earned per month worked
const MAX_DAYS_PER_SINGLE_REQUEST = 14; // above this → REFER_HR

// ─── Module Evaluator ─────────────────────────────────────────────────────────

export function evaluateAnnual(
  request: LeaveRequest,
  employee: EmployeeProfile
): DecisionResult {
  const flags: DecisionFlag[] = [];
  const { daysRequested, isEmergency } = request;
  const balance = employee.leaveBalance.annual;

  // How many days has the employee actually accrued based on service?
  const accrued = Math.min(
    Math.floor(employee.monthsWorked * ACCRUAL_PER_MONTH),
    ANNUAL_DAYS_PER_YEAR
  );

  // Effective available = whichever is lower: accrued or remaining balance
  const available = Math.min(accrued, balance);

  // ── Rule 1: Requesting more than what's available ─────────────────────────
  if (daysRequested > available) {
    const canTakePartial = available > 0;

    if (canTakePartial) {
      flags.push("INSUFFICIENT_BALANCE", "PARTIAL_APPROVAL_POSSIBLE");
    } else {
      flags.push("INSUFFICIENT_BALANCE");
    }

    if (isEmergency) flags.push("EMERGENCY_FLAGGED");

    return {
      decision: "DENIED",
      module: "annual",
      reason: `You requested ${daysRequested} days but only have ${available} annual leave days remaining this year.`,
      flags,
      canOverride: canTakePartial, // chat can explore partial approval
      suggestions: canTakePartial
        ? [
            `You could take ${available} days now and apply for the remainder next cycle.`,
            "You may also carry over unused days subject to management approval.",
          ]
        : [
            "Your annual leave balance is exhausted. Consider applying for unpaid leave through HR.",
          ],
    };
  }

  // ── Rule 2: Large block — needs HR sign-off ───────────────────────────────
  if (daysRequested > MAX_DAYS_PER_SINGLE_REQUEST) {
    flags.push("EXCEEDS_SINGLE_REQUEST_LIMIT");
    return {
      decision: "REFER_HR",
      module: "annual",
      reason: `Requests exceeding ${MAX_DAYS_PER_SINGLE_REQUEST} consecutive annual leave days require HR and management approval.`,
      flags,
      canOverride: false,
    };
  }

  // ── Rule 3: Emergency flag — note it but still approve if balance allows ──
  if (isEmergency) {
    flags.push("EMERGENCY_FLAGGED");
  }

  // ── All checks passed ─────────────────────────────────────────────────────
  return {
    decision: "APPROVED",
    module: "annual",
    daysApproved: daysRequested,
    reason: `Your request for ${daysRequested} days of annual leave has been approved. You will have ${available - daysRequested} days remaining after this.`,
    flags,
    canOverride: false,
    suggestions: [],
  };
}
