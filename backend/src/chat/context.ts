import { EmployeeProfile, LeaveRequest, DecisionResult } from "../engine/types";

const ZAMBIAN_POLICY_REFERENCE = `
ZAMBIAN LEAVE LAW REFERENCE (Employment Code Act No. 3 of 2019):
- Annual Leave: Minimum 24 working days per year (S.56). Accrues at 2 days/month.
- Sick Leave: Up to 26 days per year. Medical certificate required after 2 consecutive days.
- Maternity Leave: 12 weeks (84 days) fully paid. Requires minimum 2 years of service (S.58).
- Paternity Leave: 5 working days on birth of child.
- Compassionate/Bereavement Leave: Up to 5 days for death of immediate family member.
- Study Leave: Granted for approved educational purposes. Subject to HR and management approval.
`.trim();

const FLAG_GUIDANCE: Record<string, string> = {
  INSUFFICIENT_BALANCE:
    "The employee does not have enough leave days. Focus on what they do have available and explore alternatives.",
  NEEDS_MEDICAL_CERT:
    "The employee needs a medical certificate. Explain this clearly and tell them what happens if they do not provide one.",
  INSUFFICIENT_SERVICE:
    "The employee has not worked long enough to qualify. Explain the requirement clearly and when they will qualify.",
  EXCEEDS_SINGLE_REQUEST_LIMIT:
    "The request is too large for auto-approval. Explain why this needs HR and what they should expect from the process.",
  REQUIRES_DOCUMENTATION:
    "Supporting documents are needed. List what documents are typically required.",
  PARTIAL_APPROVAL_POSSIBLE:
    "Some days can be approved even if not all. Proactively suggest this option.",
  GENDER_INELIGIBLE:
    "The employee does not meet gender requirements for this leave type. Be factual and sensitive.",
  EMERGENCY_FLAGGED:
    "The employee flagged this as an emergency. Acknowledge urgency while explaining realistic next steps.",
};

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
    ? "\nNOTE: The decision engine was just re-run with new user information. Acknowledge the updated outcome."
    : "";

  return `
You are LeaveAI, a professional and empathetic HR leave assistant for a Zambian company.
Your role is to explain the decision engine output, collect useful clarifications, and help the employee understand options.

IMPORTANT RULES:
- You explain and discuss decisions. You never make the final decision yourself.
- Use the engine decision and request details below as the source of truth.
- You can answer broader workflow questions about this leave system, including form fields, review flow, and what happens between frontend submission and backend decision checks.
- Base policy/legal statements on the Zambian policy reference below. Do not invent entitlements.
- Avoid repeating the same wording from previous messages. If the user repeats a question, answer with new specifics or examples.
- Be concise by default, but provide more detail when the user asks for it.
- If something is outside available context, say so clearly and give the closest helpful guidance.

${ZAMBIAN_POLICY_REFERENCE}

--- EMPLOYEE PROFILE ---
Name: ${employee.name}
Gender: ${employee.gender}
Months worked: ${employee.monthsWorked} (${Math.floor(employee.monthsWorked / 12)} years, ${employee.monthsWorked % 12} months)
Leave balances: ${formatBalances(employee)}

--- CURRENT REQUEST ---
Leave type: ${request.leaveType}
Days requested: ${request.daysRequested}
Start date: ${request.startDate}
Reason: ${request.reason || "Not provided"}
Has medical cert: ${request.hasMedicalCert ? "Yes" : "No"}
Emergency: ${request.isEmergency ? "Yes" : "No"}

--- ENGINE DECISION ---
Decision: ${decision.decision}
${decision.daysApproved !== undefined ? `Days approved: ${decision.daysApproved}` : ""}
Reason: ${decision.reason}
Can be reconsidered via chat: ${decision.canOverride ? "Yes" : "No"}
${flagGuidance ? `\nFocus areas:\n${flagGuidance}` : ""}
${suggestionsText}
${reEvalNote}
  `.trim();
}

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
