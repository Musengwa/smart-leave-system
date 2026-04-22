import { LeaveRequest, EmployeeProfile, DecisionResult, LeaveType } from "./types";
import { evaluateAnnual } from "../modules/annual";
import { evaluateSick } from "../modules/sick";
import { evaluateMaternity } from "../modules/maternity";
import { evaluatePaternity } from "../modules/paternity";
import { evaluateCompassionate } from "../modules/compassionate";
import { evaluateStudy } from "../modules/study";

// ─── Module Registry ──────────────────────────────────────────────────────────
// Add each module here as it gets built. The engine stays clean — it just
// routes and never contains leave logic itself.

type ModuleEvaluator = (
  request: LeaveRequest,
  employee: EmployeeProfile
) => DecisionResult;

const moduleRegistry: Record<LeaveType, ModuleEvaluator | null> = {
  annual: evaluateAnnual,
  sick: evaluateSick,
  maternity: evaluateMaternity,
  paternity: evaluatePaternity,
  compassionate: evaluateCompassionate,
  study: evaluateStudy,
};

// ─── Main Engine Entry Point ──────────────────────────────────────────────────

export function runDecisionEngine(
  request: LeaveRequest,
  employee: EmployeeProfile
): DecisionResult {
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

  // Guard: basic sanity checks before hitting the module
  const sanityCheck = runSanityChecks(request);
  if (sanityCheck) return { ...sanityCheck, module: request.leaveType };

  // Run the module
  const result = evaluator(request, employee);

  // Enforce: REFER_HR decisions can never be overridden by chat
  if (result.decision === "REFER_HR") {
    result.canOverride = false;
  }

  return result;
}

// ─── Sanity Checks (apply to all modules) ────────────────────────────────────

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

  return null; // all good
}
