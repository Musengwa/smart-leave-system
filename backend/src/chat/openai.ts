import OpenAI from "openai";
import { ChatContext, ChatMessage, DecisionResult, LeaveRequest, EmployeeProfile } from "../engine/types";
import { buildSystemPrompt } from "./context";
import { runDecisionEngine } from "../engine/index";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ─── Send a message and get a response ───────────────────────────────────────

export async function sendChatMessage(
  userMessage: string,
  context: ChatContext
): Promise<{ reply: string; updatedContext: ChatContext }> {

  // Append the new user message to history
  const updatedHistory: ChatMessage[] = [
    ...context.history,
    { role: "user", content: userMessage },
  ];

  // Check if the user's message contains enough new info to re-run the engine
  const reEvalResult = await checkForReEvaluation(userMessage, context);

  // If engine changed its decision, update the context with the new decision
  const activeDecision = reEvalResult ?? context.decision;

  // Build the system prompt with current decision context
  const systemPrompt = buildSystemPrompt(
    context.employee,
    context.request,
    activeDecision,
    reEvalResult !== null // flag so ChatGPT knows a re-evaluation just happened
  );

  // Build messages array for OpenAI — system prompt + full history
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...updatedHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    max_tokens: 500,
    temperature: 0.4, // low temp = consistent, professional tone
  });

  const reply =
    response.choices[0]?.message?.content?.trim() ??
    "I'm sorry, I wasn't able to process that. Please try again.";

  // Append assistant reply to history
  const finalHistory: ChatMessage[] = [
    ...updatedHistory,
    { role: "assistant", content: reply },
  ];

  return {
    reply,
    updatedContext: {
      ...context,
      decision: activeDecision,
      history: finalHistory,
    },
  };
}

// ─── Re-evaluation Logic ──────────────────────────────────────────────────────
// Checks if the user has provided new information that could change the decision.
// Only runs if the current decision has canOverride: true.

async function checkForReEvaluation(
  userMessage: string,
  context: ChatContext
): Promise<DecisionResult | null> {

  // Hard stop — this decision cannot be changed via chat
  if (!context.decision.canOverride) return null;

  // Ask GPT to extract any new structured info from the user's message
  // This keeps the re-evaluation logic clean — we don't do regex hacks
  const extractionPrompt = `
You are a data extractor. The user is chatting about a leave request.
Their original request: ${JSON.stringify(context.request)}

The user just said: "${userMessage}"

If the user has provided NEW information that changes the leave request 
(e.g. fewer days, confirmation they have a medical cert, a different start date),
respond ONLY with a JSON object of the changed fields. Example:
{"daysRequested": 3, "hasMedicalCert": true}

If there is no new actionable information, respond with exactly: null
Do not include any explanation or markdown.
  `.trim();

  const extraction = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: extractionPrompt }],
    max_tokens: 100,
    temperature: 0,
  });

  const raw = extraction.choices[0]?.message?.content?.trim();

  if (!raw || raw === "null") return null;

  try {
    const updatedFields = JSON.parse(raw);

    // Merge new fields into the original request
    const updatedRequest: LeaveRequest = {
      ...context.request,
      ...updatedFields,
    };

    // Re-run the engine with updated request
    const newDecision = runDecisionEngine(updatedRequest, context.employee);
    return newDecision;

  } catch {
    // Extraction failed to parse — just continue with existing decision
    return null;
  }
}

// ─── Build initial assistant message after form submission ───────────────────
// This is the first thing the user sees when the chat opens.

export async function buildOpeningMessage(
  employee: EmployeeProfile,
  request: LeaveRequest,
  decision: DecisionResult
): Promise<string> {

  const systemPrompt = buildSystemPrompt(employee, request, decision, false);

  const openingInstruction =
    decision.decision === "APPROVED"
      ? "Greet the employee warmly, confirm their leave is approved, tell them the exact days approved, and invite any questions."
      : decision.decision === "DENIED"
      ? "Greet the employee, explain the reason for denial clearly but empathetically, and present any suggestions or alternatives."
      : decision.decision === "PENDING_INFO"
      ? "Greet the employee and ask for the specific missing information needed to make a decision."
      : "This should never reach chat — REFER_HR is a hard stop.";

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: openingInstruction },
    ],
    max_tokens: 300,
    temperature: 0.4,
  });

  return (
    response.choices[0]?.message?.content?.trim() ??
    `Hello ${employee.name}, your leave request has been received.`
  );
}
