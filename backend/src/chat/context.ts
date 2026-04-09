import { EmployeeProfile, LeaveRequest, DecisionResult } from "../engine/types";

// ─── Zambian Leave Policy Reference ──────────────────────────────────────────
// Baked into every system prompt so ChatGPT always has the legal grounding

const ZAMBIAN_POLICY_REFERENCE = `
ZAMBIAN LEAVE LAW REFERENCE (Employment Code Act No. 3 of 2019):
- Annual Leave: Minimum 24 working days per year (S.56). Accrues at 2 days/month.
- Sick Leave: Up to 26 days per year. Medical certificate required after 2 consecutive days.
- Maternity Leave: 12 weeks (84 days) fully paid. Requires minimum 2 years of service (S.58).
- Paternity Leave: 5 working days on birth of child.
- Compassionate/Bereavement Leave: Up to 5 days for death of immediate family member.
- Study Leave: Granted for approved educational purposes. Subject to HR and management approval.
`.trim();

// ─── Flag Descriptions ────────────────────────────────────────────────────────
// Human-readable explanations of each flag, used to guide ChatGPT's response

const FLAG_GUIDANCE: Record<string, string> = {
  INSUFFICIENT_BALANCE:
    "The employee does not have enough leave days. Focus on what they DO have available and explore alternatives.",
  NEEDS_MEDICAL_CERT:
    "The employee needs a medical certificate. Explain this clearly and tell them what happens if they don't provide one.",
  INSUFFICIENT_SERVICE:
    "The employee hasn't worked long enough to qualify. Be empathetic — explain the requirement and when they will qualify.",
  EXCEEDS_SINGLE_REQUEST_LIMIT:
    "The request is too large for auto-approval. Explain why this needs HR and what they should expect from that process.",
  REQUIRES_DOCUMENTATION:
    "Supporting documents are needed. List what documents are typically required.",
  PARTIAL_APPROVAL_POSSIBLE:
    "Some days can be approved even if not all. Proactively suggest this option to the employee.",
  GENDER_INELIGIBLE:
    "The employee does not meet gender requirements for this leave type. Be factual and sensitive.",
  EMERGENCY_FLAGGED:
    "The employee flagged this as an emergency. Acknowledge the urgency while explaining the process.",
};

// ─── Main Context Builder ─────────────────────────────────────────────────────

export function buildSystemPrompt(
  employee: EmployeeProfile,
  request: LeaveRequest,
  decision: DecisionResult,
  wasReEvaluated: boolean
): string {

  const flagGuidance = decision.flags
    .map((f) => `- ${FLAG_GUIDANCE[f] ?? f}`)
    .join("\n");

  const suggestionsText =
    decision.suggestions && decision.suggestions.length > 0
      ? `\nSuggestions from the engine:\n${decision.suggestions.map((s) => `- ${s}`).join("\n")}`
      : "";

  const reEvalNote = wasReEvaluated
    ? "\nNOTE: The decision engine just re-evaluated this request based on new information from the employee. Acknowledge that the decision has been updated."
    : "";

  return `
You are LeaveAI, a professional and empathetic HR leave assistant for a Zambian company.
Your job is to explain leave decisions to employees and help them explore their options.

IMPORTANT RULES:
- You explain and discuss decisions — you NEVER make them. The decision engine is the authority.
- You can collect new information from the employee and the engine will re-evaluate if needed.
- Be warm, clear, and concise. No corporate jargon.
- Always ground your answers in Zambian labour law when relevant.
- Never make up policies or invent entitlements.
- Keep responses under 4 sentences unless the employee asks for more detail.

${ZAMBIAN_POLICY_REFERENCE}

─── EMPLOYEE PROFILE ───────────────────────────────────────
Name: ${employee.name}
Gender: ${employee.gender}
Months worked: ${employee.monthsWorked} (${Math.floor(employee.monthsWorked / 12)} years, ${employee.monthsWorked % 12} months)
Leave balances: ${formatBalances(employee)}

─── CURRENT REQUEST ────────────────────────────────────────
Leave type: ${request.leaveType}
Days requested: ${request.daysRequested}
Start date: ${request.startDate}
Reason: ${request.reason || "Not provided"}
Has medical cert: ${request.hasMedicalCert ? "Yes" : "No"}
Emergency: ${request.isEmergency ? "Yes" : "No"}

─── ENGINE DECISION ────────────────────────────────────────
Decision: ${decision.decision}
${decision.daysApproved !== undefined ? `Days approved: ${decision.daysApproved}` : ""}
Reason: ${decision.reason}
Can be reconsidered via chat: ${decision.canOverride ? "Yes" : "No"}
${flagGuidance ? `\nFocus areas:\n${flagGuidance}` : ""}
${suggestionsText}
${reEvalNote}
  `.trim();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBalances(employee: EmployeeProfile): string {
  const b = employee.leaveBalance;
  return [
    `Annual: ${b.annual} days`,
    `Sick: ${b.sick} days`,
    `Maternity: ${b.maternity} days`,
    `Paternity: ${b.paternity} days`,
    `Compassionate: ${b.compassionate} days`,
    `Study: ${b.study} days`,
  ].join(", ");
}
