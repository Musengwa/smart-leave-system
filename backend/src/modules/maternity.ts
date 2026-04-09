import { LeaveRequest, EmployeeProfile, DecisionResult, DecisionFlag } from "../engine/types";

// ─── Policy Constants (Employment Code Act No. 3 of 2019, S.58) ──────────────

const MATERNITY_DAYS = 84;        // 12 weeks
const MIN_SERVICE_MONTHS = 24;    // 2 years of service required

// ─── Module Evaluator ─────────────────────────────────────────────────────────

export function evaluateMaternity(
  request: LeaveRequest,
  employee: EmployeeProfile
): DecisionResult {
  const flags: DecisionFlag[] = [];

  // ── Rule 1: Gender check ──────────────────────────────────────────────────
  if (employee.gender !== "female") {
    flags.push("GENDER_INELIGIBLE");
    return {
      decision: "DENIED",
      module: "maternity",
      reason: "Maternity leave is available to female employees only under the Employment Code Act.",
      flags,
      canOverride: false,
    };
  }

  // ── Rule 2: Minimum service requirement ───────────────────────────────────
  if (employee.monthsWorked < MIN_SERVICE_MONTHS) {
    const monthsRemaining = MIN_SERVICE_MONTHS - employee.monthsWorked;
    flags.push("INSUFFICIENT_SERVICE");
    return {
      decision: "REFER_HR",
      module: "maternity",
      reason: `Maternity leave requires a minimum of 2 years of service. You have ${Math.floor(employee.monthsWorked / 12)} year(s) and ${employee.monthsWorked % 12} month(s). You need ${monthsRemaining} more month(s) to qualify. HR may be able to discuss options for your specific situation.`,
      flags,
      canOverride: false,
    };
  }

  // ── Rule 3: Maternity always requires HR coordination ─────────────────────
  // Even when the employee qualifies, maternity involves medical documentation,
  // payroll coordination, and handover planning — HR must be involved.
  flags.push("REQUIRES_DOCUMENTATION");
  return {
    decision: "REFER_HR",
    module: "maternity",
    reason: `You qualify for ${MATERNITY_DAYS} days (12 weeks) of fully paid maternity leave. However, maternity leave requires HR coordination for documentation, payroll, and handover planning. HR will guide you through the process.`,
    flags,
    canOverride: false,
    suggestions: [
      "Prepare a medical certificate confirming your pregnancy and expected due date.",
      "Notify HR at least 4 weeks before your intended start date where possible.",
      "Discuss a handover plan with your line manager before going on leave.",
    ],
  };
}
