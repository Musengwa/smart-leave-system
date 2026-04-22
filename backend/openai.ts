import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatContext, ChatMessage, DecisionResult, LeaveRequest, EmployeeProfile } from "../engine/types";
import { buildSystemPrompt } from "./context";
import { runDecisionEngine } from "../engine/index";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// ─── Send a message and get a response ───────────────────────────────────────

export async function sendChatMessage(
  userMessage: string,
  context: ChatContext
): Promise<{ reply: string; updatedContext: ChatContext }> {

  const updatedHistory: ChatMessage[] = [
    ...context.history,
    { role: "user", content: userMessage },
  ];

  const reEvalResult = await checkForReEvaluation(userMessage, context);
  const activeDecision = reEvalResult ?? context.decision;

  const systemPrompt = buildSystemPrompt(
    context.employee,
    context.request,
    activeDecision,
    reEvalResult !== null
  );

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: systemPrompt,
  });

  // Build history in Gemini format (excludes the latest user message)
  const geminiHistory = updatedHistory.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({ history: geminiHistory });
  const result = await chat.sendMessage(userMessage);
  const reply = result.response.text();

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

async function checkForReEvaluation(
  userMessage: string,
  context: ChatContext
): Promise<DecisionResult | null> {

  if (!context.decision.canOverride) return null;

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
You are a data extractor. The user is chatting about a leave request.
Their original request: ${JSON.stringify(context.request)}
The user just said: "${userMessage}"

If the user provided NEW information that changes the request
(e.g. fewer days, has a medical cert, different start date),
respond ONLY with a JSON object of the changed fields. Example:
{"daysRequested": 3, "hasMedicalCert": true}

If no new actionable information, respond with exactly: null
No explanation, no markdown.
  `.trim();

  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim();

  if (!raw || raw === "null") return null;

  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const updatedFields = JSON.parse(clean);
    const updatedRequest: LeaveRequest = { ...context.request, ...updatedFields };
    return runDecisionEngine(updatedRequest, context.employee);
  } catch {
    return null;
  }
}

// ─── Opening message ──────────────────────────────────────────────────────────

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
      : "Greet the employee and ask for the specific missing information needed to make a decision.";

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: systemPrompt,
  });

  const result = await model.generateContent(openingInstruction);
  return result.response.text();
}