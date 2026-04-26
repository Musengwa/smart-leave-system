import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import {
  ChatContext,
  ChatMessage,
  DecisionResult,
  EmployeeProfile,
  LeaveRequest,
  LeaveType,
} from "../engine/types";
import { runDecisionEngine } from "../engine/index";
import { buildSystemPrompt } from "./context";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim();
const GEMINI_MODEL_FALLBACKS = (process.env.GEMINI_MODEL_FALLBACKS || "")
  .split(",")
  .map((model) => model.trim())
  .filter((model): model is string => Boolean(model));
const DEFAULT_GEMINI_MODELS = [
  "gemini-2.0-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash",
  "gemini-1.5-pro-latest",
  "gemini-1.5-pro",
];
const GEMINI_MODEL_CANDIDATES = Array.from(
  new Set(
    [GEMINI_MODEL, ...GEMINI_MODEL_FALLBACKS, ...DEFAULT_GEMINI_MODELS].filter(
      (model): model is string => Boolean(model)
    )
  )
);
const AI_PROVIDER = (process.env.AI_PROVIDER || "auto").toLowerCase();

const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
const gemini = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

const DEFAULT_HISTORY_LIMIT = 16;
const HISTORY_LIMIT = Number.parseInt(process.env.AI_HISTORY_MESSAGES ?? "", 10);
const MAX_HISTORY_MESSAGES =
  Number.isFinite(HISTORY_LIMIT) && HISTORY_LIMIT > 0 ? HISTORY_LIMIT : DEFAULT_HISTORY_LIMIT;

const VALID_LEAVE_TYPES: LeaveType[] = [
  "annual",
  "sick",
  "maternity",
  "paternity",
  "compassionate",
  "study",
];

type AIProvider = "openai" | "gemini" | "none";
type ReEvaluationResult = {
  decision: DecisionResult;
  updatedRequest: LeaveRequest;
};

type ErrorWithStatus = {
  status?: unknown;
  statusCode?: unknown;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function getErrorStatusCode(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const withStatus = error as ErrorWithStatus;
  if (typeof withStatus.status === "number") return withStatus.status;
  if (typeof withStatus.statusCode === "number") return withStatus.statusCode;
  return null;
}

function isGeminiModelUnavailableError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  const hasNotFoundMessage =
    message.includes("not found") ||
    message.includes("is not found for api version") ||
    message.includes("not supported for generatecontent");

  if (hasNotFoundMessage) return true;

  const status = getErrorStatusCode(error);
  if (status === 404) return true;

  return false;
}

function getSecondaryProvider(primary: AIProvider): AIProvider {
  if (primary === "gemini" && openai) return "openai";
  if (primary === "openai" && gemini) return "gemini";
  return "none";
}

function shouldFailoverToSecondaryProvider(primary: AIProvider, error: unknown): boolean {
  const status = getErrorStatusCode(error);
  const message = getErrorMessage(error).toLowerCase();

  if (primary === "gemini") {
    if ([404, 429, 500, 503].includes(status ?? -1)) return true;
    if (
      message.includes("quota") ||
      message.includes("rate limit") ||
      message.includes("too many requests") ||
      message.includes("resource exhausted")
    ) {
      return true;
    }
  }

  if (primary === "openai") {
    if ([429, 500, 502, 503, 504].includes(status ?? -1)) return true;
    if (
      message.includes("quota") ||
      message.includes("rate limit") ||
      message.includes("too many requests")
    ) {
      return true;
    }
  }

  return false;
}

async function runWithProviderFailover<T>(
  execute: (provider: Exclude<AIProvider, "none">) => Promise<T>
): Promise<T> {
  const primary = resolveProvider();
  if (primary === "none") {
    throw new Error("No AI provider configured.");
  }

  try {
    return await execute(primary);
  } catch (error) {
    const secondary = getSecondaryProvider(primary);
    if (secondary === "none" || !shouldFailoverToSecondaryProvider(primary, error)) {
      throw error;
    }

    console.warn(
      `[AI] Primary provider "${primary}" failed (${getErrorMessage(
        error
      )}). Retrying with "${secondary}".`
    );

    return execute(secondary);
  }
}

async function runWithGeminiModelFallback<T>(
  execute: (modelName: string) => Promise<T>
): Promise<T> {
  if (GEMINI_MODEL_CANDIDATES.length === 0) {
    throw new Error("No Gemini models configured.");
  }

  let lastError: unknown = null;

  for (let index = 0; index < GEMINI_MODEL_CANDIDATES.length; index += 1) {
    const modelName = GEMINI_MODEL_CANDIDATES[index];

    try {
      return await execute(modelName);
    } catch (error) {
      lastError = error;
      const hasNextModel = index < GEMINI_MODEL_CANDIDATES.length - 1;

      if (!hasNextModel || !isGeminiModelUnavailableError(error)) {
        throw error;
      }

      const nextModel = GEMINI_MODEL_CANDIDATES[index + 1];
      console.warn(
        `[Gemini] Model "${modelName}" unavailable. Retrying with "${nextModel}".`
      );
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error("No Gemini model candidates are available.");
}

function resolveProvider(): AIProvider {
  if (AI_PROVIDER === "openai") {
    if (openai) return "openai";
    if (gemini) return "gemini";
    return "none";
  }

  if (AI_PROVIDER === "gemini") {
    if (gemini) return "gemini";
    if (openai) return "openai";
    return "none";
  }

  if (openai) return "openai";
  if (gemini) return "gemini";
  return "none";
}

function getRecentHistory(history: ChatMessage[]): ChatMessage[] {
  return history
    .filter((msg) => msg.role === "user" || msg.role === "assistant")
    .slice(-MAX_HISTORY_MESSAGES);
}

function buildFallbackReply(decision: DecisionResult): string {
  const suggestions = decision.suggestions?.length
    ? ` Next steps: ${decision.suggestions.join(" ")}`
    : "";

  if (decision.decision === "APPROVED") {
    return `Your request is approved.${suggestions} I can also explain policy details, balances, or what happens next in the workflow.`;
  }

  if (decision.decision === "DENIED") {
    return `${decision.reason}${suggestions} If you want, I can walk through alternatives.`;
  }

  if (decision.decision === "PENDING_INFO") {
    return `${decision.reason} Share the missing details and I can re-check immediately.`;
  }

  return "This request has been referred to HR. Please contact HR for next steps.";
}

function buildFallbackOpeningMessage(employee: EmployeeProfile, decision: DecisionResult): string {
  return `Hello ${employee.name}, your leave request has been received. ${buildFallbackReply(decision)}`;
}

function parseBooleanish(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "y", "1"].includes(normalized)) return true;
    if (["false", "no", "n", "0"].includes(normalized)) return false;
  }
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return null;
}

function isValidDateString(value: string): boolean {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp);
}

function sanitizeUpdatedFields(raw: Record<string, unknown>): Partial<LeaveRequest> | null {
  const updates: Partial<LeaveRequest> = {};

  if (typeof raw.leaveType === "string") {
    const leaveType = raw.leaveType.trim().toLowerCase() as LeaveType;
    if (VALID_LEAVE_TYPES.includes(leaveType)) {
      updates.leaveType = leaveType;
    }
  }

  if (raw.daysRequested !== undefined) {
    const parsedDays = Number(raw.daysRequested);
    if (Number.isFinite(parsedDays) && parsedDays > 0 && parsedDays <= 365) {
      updates.daysRequested = Math.round(parsedDays);
    }
  }

  if (typeof raw.startDate === "string") {
    const normalizedDate = raw.startDate.trim();
    if (normalizedDate && isValidDateString(normalizedDate)) {
      updates.startDate = normalizedDate;
    }
  }

  if (typeof raw.reason === "string") {
    updates.reason = raw.reason.trim();
  }

  if (raw.hasMedicalCert !== undefined) {
    const parsed = parseBooleanish(raw.hasMedicalCert);
    if (parsed !== null) updates.hasMedicalCert = parsed;
  }

  if (raw.isEmergency !== undefined) {
    const parsed = parseBooleanish(raw.isEmergency);
    if (parsed !== null) updates.isEmergency = parsed;
  }

  return Object.keys(updates).length > 0 ? updates : null;
}

function parseExtractionResponse(rawText: string | null | undefined): Partial<LeaveRequest> | null {
  if (!rawText) return null;

  const normalized = rawText.replace(/```json|```/gi, "").trim();
  if (!normalized || normalized.toLowerCase() === "null") return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    const match = normalized.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  return sanitizeUpdatedFields(parsed as Record<string, unknown>);
}

function didRequestChange(previous: LeaveRequest, next: LeaveRequest): boolean {
  return JSON.stringify(previous) !== JSON.stringify(next);
}

async function generateFromOpenAI(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  temperature: number
): Promise<string | null> {
  if (!openai) return null;

  const response = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: maxTokens,
    temperature,
    presence_penalty: 0.35,
    frequency_penalty: 0.25,
  });

  return response.choices[0]?.message?.content?.trim() ?? null;
}

async function generateFromGemini(
  systemPrompt: string,
  userPrompt: string,
  maxOutputTokens: number,
  temperature: number
): Promise<string | null> {
  if (!gemini) return null;

  return runWithGeminiModelFallback(async (modelName) => {
    const model = gemini.getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature,
        topP: 0.9,
        maxOutputTokens,
      },
    });

    const result = await model.generateContent(userPrompt);
    return result.response.text().trim() || null;
  });
}

async function generateWithActiveProvider(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  temperature: number
): Promise<string | null> {
  return runWithProviderFailover(async (provider) => {
    if (provider === "openai") {
      return generateFromOpenAI(systemPrompt, userPrompt, maxTokens, temperature);
    }

    return generateFromGemini(systemPrompt, userPrompt, maxTokens, temperature);
  });
}

async function generateChatReplyFromOpenAI(
  systemPrompt: string,
  recentHistory: ChatMessage[]
): Promise<string | null> {
  if (!openai) return null;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...recentHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const response = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages,
    max_tokens: 700,
    temperature: 0.65,
    presence_penalty: 0.35,
    frequency_penalty: 0.25,
  });

  return response.choices[0]?.message?.content?.trim() ?? null;
}

async function generateChatReplyFromGemini(
  systemPrompt: string,
  recentHistory: ChatMessage[],
  latestUserMessage: string
): Promise<string | null> {
  if (!gemini) return null;

  return runWithGeminiModelFallback(async (modelName) => {
    const model = gemini.getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 700,
      },
    });

    const geminiHistory = recentHistory.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessage(latestUserMessage);
    return result.response.text().trim() || null;
  });
}

async function generateChatReply(
  systemPrompt: string,
  recentHistory: ChatMessage[],
  latestUserMessage: string
): Promise<string | null> {
  return runWithProviderFailover(async (provider) => {
    if (provider === "openai") {
      return generateChatReplyFromOpenAI(systemPrompt, recentHistory);
    }

    return generateChatReplyFromGemini(systemPrompt, recentHistory, latestUserMessage);
  });
}

async function extractUpdatedRequestFields(
  userMessage: string,
  context: ChatContext
): Promise<Partial<LeaveRequest> | null> {
  const provider = resolveProvider();
  if (provider === "none") return null;

  const recentConversation = getRecentHistory(context.history)
    .slice(-8)
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join("\n");

  const extractionPrompt = `
You are a strict JSON extractor for leave-request updates.
Current leave request:
${JSON.stringify(context.request)}

Recent conversation (oldest to newest):
${recentConversation || "No prior conversation"}

Latest user message:
"${userMessage}"

Return ONLY:
- a JSON object with changed fields from this set:
  leaveType, daysRequested, startDate, reason, hasMedicalCert, isEmergency
- OR null if nothing changes.

Rules:
- No markdown, no explanation.
- Do not include unchanged fields.
- leaveType must be one of: ${VALID_LEAVE_TYPES.join(", ")}.
- Keep keys exactly as written above.
`.trim();

  const raw = await generateWithActiveProvider(
    "You only extract updated leave-request fields and return strict JSON or null.",
    extractionPrompt,
    180,
    0
  );

  return parseExtractionResponse(raw);
}

async function checkForReEvaluation(
  userMessage: string,
  context: ChatContext
): Promise<ReEvaluationResult | null> {
  if (!context.decision.canOverride) return null;

  let updatedFields: Partial<LeaveRequest> | null = null;
  try {
    updatedFields = await extractUpdatedRequestFields(userMessage, context);
  } catch (error) {
    console.warn("[checkForReEvaluation] Skipping extraction due to AI error:", error);
    return null;
  }

  if (!updatedFields) return null;

  const updatedRequest: LeaveRequest = {
    ...context.request,
    ...updatedFields,
  };

  if (!didRequestChange(context.request, updatedRequest)) return null;

  const newDecision = runDecisionEngine(updatedRequest, context.employee);
  return { decision: newDecision, updatedRequest };
}

export async function sendChatMessage(
  userMessage: string,
  context: ChatContext
): Promise<{ reply: string; updatedContext: ChatContext }> {
  const normalizedUserMessage = userMessage.trim();

  const historyWithUser: ChatMessage[] = [
    ...context.history,
    { role: "user", content: normalizedUserMessage },
  ];

  const reEvalResult = await checkForReEvaluation(normalizedUserMessage, {
    ...context,
    history: historyWithUser,
  });

  const activeDecision = reEvalResult?.decision ?? context.decision;
  const activeRequest = reEvalResult?.updatedRequest ?? context.request;

  const systemPrompt = buildSystemPrompt(
    context.employee,
    activeRequest,
    activeDecision,
    reEvalResult !== null
  );

  const recentHistory = getRecentHistory(historyWithUser);

  let reply = buildFallbackReply(activeDecision);
  try {
    const generated = await generateChatReply(systemPrompt, recentHistory, normalizedUserMessage);
    if (generated) reply = generated;
  } catch (error) {
    console.error("[sendChatMessage] AI provider fallback triggered:", error);
  }

  const finalHistory: ChatMessage[] = [
    ...historyWithUser,
    { role: "assistant", content: reply },
  ];

  return {
    reply,
    updatedContext: {
      ...context,
      request: activeRequest,
      decision: activeDecision,
      history: finalHistory,
    },
  };
}

export async function buildOpeningMessage(
  employee: EmployeeProfile,
  request: LeaveRequest,
  decision: DecisionResult
): Promise<string> {
  const systemPrompt = buildSystemPrompt(employee, request, decision, false);

  const openingInstruction =
    decision.decision === "APPROVED"
      ? "Welcome the employee, confirm approval and approved days, and offer help with policy, next steps, or process questions."
      : decision.decision === "DENIED"
      ? "Welcome the employee, explain the denial clearly, suggest alternatives, and offer to discuss policy and what can change the outcome."
      : decision.decision === "PENDING_INFO"
      ? "Welcome the employee, list exactly what is missing, and invite follow-up questions about policy and submission process."
      : "This should never reach chat because REFER_HR is a hard stop.";

  try {
    const generated = await generateWithActiveProvider(
      systemPrompt,
      openingInstruction,
      350,
      0.55
    );
    return generated ?? buildFallbackOpeningMessage(employee, decision);
  } catch (error) {
    console.error("[buildOpeningMessage] AI provider fallback triggered:", error);
    return buildFallbackOpeningMessage(employee, decision);
  }
}
