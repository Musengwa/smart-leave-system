import { LeaveRequest, EmployeeProfile, DecisionResult, DecisionFlag } from "../engine/types";

// ─── Policy Constants ─────────────────────────────────────────────────────────

const SICK_DAYS_PER_YEAR = 26;
const MED_CERT_REQUIRED_AFTER = 2;  // days before a medical cert is mandatory
const MAX_DAYS_PER_SINGLE_REQUEST = 10; // above this → REFER_HR

// ─── Module Evaluator ─────────────────────────────────────────────────────────

export function evaluateSick(
  request: LeaveRequest,
  employee: EmployeeProfile
): DecisionResult {
  const flags: DecisionFlag[] = [];
  const { daysRequested, hasMedicalCert, isEmergency } = request;
  const balance = employee.leaveBalance.sick;

  if (isEmergency) flags.push("EMERGENCY_FLAGGED");

  // ── Rule 1: Large sick leave block → HR handles it ────────────────────────
  // Extended sick leave may involve medical boarding, disability assessment etc.
  if (daysRequested > MAX_DAYS_PER_SINGLE_REQUEST) {
    flags.push("EXCEEDS_SINGLE_REQUEST_LIMIT", "REQUIRES_DOCUMENTATION");
    return {
      decision: "REFER_HR",
      module: "sick",
      reason: `Sick leave requests exceeding ${MAX_DAYS_PER_SINGLE_REQUEST} days require HR review and supporting medical documentation.`,
      flags,
      canOverride: false,
    };
  }

  // ── Rule 2: Insufficient balance ─────────────────────────────────────────
  if (daysRequested > balance) {
    const canTakePartial = balance > 0;
    flags.push("INSUFFICIENT_BALANCE");
    if (canTakePartial) flags.push("PARTIAL_APPROVAL_POSSIBLE");

    return {
      decision: "DENIED",
      module: "sick",
      reason: `You requested ${daysRequested} sick days but only have ${balance} remaining this year.`,
      flags,
      canOverride: canTakePartial,
      suggestions: canTakePartial
        ? [`You have ${balance} sick days available. You could take those now.`]
        : [
            "Your sick leave balance is exhausted. HR can assess unpaid sick leave options, especially with a medical certificate.",
          ],
    };
  }

  // ── Rule 3: Medical certificate required but not provided ─────────────────
  if (daysRequested > MED_CERT_REQUIRED_AFTER && !hasMedicalCert) {
    flags.push("NEEDS_MEDICAL_CERT");

    // Approve but make cert a hard condition on return
    return {
      decision: "APPROVED",
      module: "sick",
      daysApproved: daysRequested,
      reason: `Your ${daysRequested}-day sick leave is approved. However, a medical certificate is required upon your return — failure to provide one may result in the days being marked as unpaid leave.`,
      flags,
      canOverride: false,
      suggestions: [
        "Visit a registered medical practitioner and obtain a certificate covering your absence dates.",
       ],
    };
  }

  // ── All checks passed ─────────────────────────────────────────────────────
  return {
    decision: "APPROVED",
    module: "sick",
    daysApproved: daysRequested,
    reason: `Your ${daysRequested}-day sick leave request has been approved. You will have ${balance - daysRequested} sick days remaining this year.`,
    flags,
    canOverride: false,
    suggestions: [],
  };
}
