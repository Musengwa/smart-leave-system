import { LeaveRequest, EmployeeProfile, DecisionResult, DecisionFlag } from "../engine/types";

// ─── Policy Constants ─────────────────────────────────────────────────────────

const COMPASSIONATE_DAYS = 5;

// Immediate family definition under Zambian law:
// spouse, child, parent, sibling, parent-in-law
// The reason field is used by ChatGPT to assess this — the engine gives benefit
// of the doubt and approves, flagging if the reason seems outside immediate family.

// ─── Module Evaluator ─────────────────────────────────────────────────────────

export function evaluateCompassionate(
  request: LeaveRequest,
  employee: EmployeeProfile
): DecisionResult {
  const flags: DecisionFlag[] = [];
  const { daysRequested, isEmergency, reason } = request;
  const balance = employee.leaveBalance.compassionate;

  // Compassionate leave is nearly always urgent
  if (isEmergency) flags.push("EMERGENCY_FLAGGED");

  // ── Rule 1: Requesting more than entitlement ──────────────────────────────
  if (daysRequested > COMPASSIONATE_DAYS) {
    flags.push("EXCEEDS_SINGLE_REQUEST_LIMIT", "PARTIAL_APPROVAL_POSSIBLE");
    return {
      decision: "DENIED",
      module: "compassionate",
      daysApproved: undefined,
      reason: `Compassionate leave is capped at ${COMPASSIONATE_DAYS} days. You requested ${daysRequested}. The maximum ${COMPASSIONATE_DAYS} days can be approved — additional days can be taken from your annual leave balance.`,
      flags,
      canOverride: true, // chat can negotiate partial + annual leave combo
      suggestions: [
        `You can take ${COMPASSIONATE_DAYS} compassionate days now.`,
        `You currently have ${employee.leaveBalance.annual} annual leave days available to cover the remaining days if needed.`,
      ],
    };
  }

  // ── Rule 2: Balance exhausted ─────────────────────────────────────────────
  if (balance <= 0) {
    flags.push("INSUFFICIENT_BALANCE");

    // Even with zero balance, compassionate circumstances warrant HR review
    return {
      decision: "REFER_HR",
      module: "compassionate",
      reason: "Your compassionate leave balance for this year has been used. Given the nature of this leave, HR will review your situation and discuss available options.",
      flags,
      canOverride: false,
      suggestions: [
        "HR may approve additional compassionate leave or allow you to use annual leave days.",
      ],
    };
  }

  // ── Rule 3: Partial balance — approve what's available ───────────────────
  if (daysRequested > balance) {
    flags.push("INSUFFICIENT_BALANCE", "PARTIAL_APPROVAL_POSSIBLE");
    return {
      decision: "APPROVED",
      module: "compassionate",
      daysApproved: balance,
      reason: `You requested ${daysRequested} days but have ${balance} compassionate days remaining. ${balance} days have been approved. The remaining ${daysRequested - balance} days can be taken from your annual leave.`,
      flags,
      canOverride: true,
      suggestions: [
        `You have ${employee.leaveBalance.annual} annual leave days available for the remaining ${daysRequested - balance} days.`,
      ],
    };
  }

  // ── All checks passed ─────────────────────────────────────────────────────
  return {
    decision: "APPROVED",
    module: "compassionate",
    daysApproved: daysRequested,
    reason: `Your ${daysRequested}-day compassionate leave has been approved. We are sorry for your loss. You will have ${balance - daysRequested} compassionate days remaining this year.`,
    flags,
    canOverride: false,
    suggestions: [],
  };
}
