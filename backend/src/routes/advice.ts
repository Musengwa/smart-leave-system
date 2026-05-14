import { Router, Request, Response } from "express";
import { generateWithActiveProvider } from "../chat/openai";
import { LeaveBalance } from "../engine/types";

const router = Router();

interface AdviceMessage {
  role: "user" | "assistant";
  content: string;
}

interface AdviceRequest {
  message: string;
  history?: AdviceMessage[];
  balances: LeaveBalance;
  currentDate?: string;
}

interface ExtractedDetails {
  leaveType?: string;
  startDate?: string;
  endDate?: string;
  reason?: string;
  daysRequested?: number;
  hasMedicalCert?: boolean;
  isEmergency?: boolean;
}

/**
 * POST /advice/message
 * Smart, conversational advice for leave planning.
 * Extracts leave details naturally from conversation.
 * Strictly advisory – does not make decisions.
 */
router.post("/message", async (req: Request, res: Response) => {
  try {
    const { message, history = [], balances, currentDate } = req.body as AdviceRequest;

    if (!message?.trim() || !balances) {
      return res.status(400).json({
        error: "Missing required fields: message, balances",
      });
    }

    const today = currentDate || new Date().toISOString().split("T")[0];

    // ── Build system prompt for friendly advisory ────────────────────────
    const systemPrompt = `You are a friendly, intelligent leave advice assistant. Your job is to help employees plan their leave by:

1. **Understanding natural language**: When they say "I'm sick tomorrow" or "I need a day off Friday because of the flu", understand they want sick leave.
2. **Extracting dates smartly**: Convert relative dates like "tomorrow", "next Monday", "this Friday" to YYYY-MM-DD format. Today is ${today}.
3. **Checking balances**: Show available leave balance when relevant: ${JSON.stringify(balances)}
4. **Suggesting leave types**: If unclear, suggest the most appropriate leave type with reason.
5. **Calendar awareness**: Discuss working days, weekends, and suggest scheduling strategically.
6. **Policy education**: Briefly explain leave policies when asked.
7. **Be conversational and warm**: Use natural language, be helpful and encouraging.

IMPORTANT:
- You are ADVISORY ONLY – you do NOT make approval/denial decisions.
- You help users understand what they can request, not whether it will be approved.
- If they ask for conflicting info or suspicious requests, note it but don't judge – just advise.
- Extract and suggest leave details naturally in conversation, don't ask forms.
- When you identify a clear leave intent, suggest the specific type, dates, and reason.

Current employee balances:
${Object.entries(balances)
  .map(([type, days]) => `- ${type}: ${days} days available`)
  .join("\n")}`;

    // ── Build conversation history ─────────────────────────────────────────
    const conversationHistory = history.length
      ? history.map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        }))
      : [];

    conversationHistory.push({
      role: "user",
      content: message.trim(),
    });

    // ── Generate reply ────────────────────────────────────────────────────
    let reply = "";
    try {
      const replyText = await generateWithActiveProvider(
        systemPrompt,
        message.trim(),
        500,
        0.7
      );
      reply = replyText || "I'm here to help with your leave planning. What would you like to know?";
    } catch (error) {
      console.error("[Advice AI generation error]", error);
      reply =
        "I'm having trouble processing that right now. Tell me more about what leave you're thinking about, and I'll try to help!";
    }

    // ── Extract leave details from the ENTIRE conversation ───────────────
    const extractedDetails = await extractLeaveDetails(
      message,
      history,
      balances,
      today
    );

    return res.status(200).json({
      reply,
      extracted: extractedDetails,
    });

  } catch (error) {
    console.error("[POST /advice/message]", error);
    return res.status(500).json({
      error: "Something went wrong. Please try again.",
    });
  }
});

/**
 * Smart extraction of leave details from entire conversation history.
 * Uses pattern matching and conversation context to understand what they want.
 */
async function extractLeaveDetails(
  userMessage: string,
  history: AdviceMessage[],
  balances: LeaveBalance,
  today: string
): Promise<ExtractedDetails> {
  // Combine all user and assistant messages for full context
  const fullConversation = history
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join("\n");

  const combinedText = fullConversation + "\nUser: " + userMessage;
  const lower = combinedText.toLowerCase();
  const details: ExtractedDetails = {};

  // ── Detect leave type ──────────────────────────────────────────────────
  const leaveTypeMap: Record<string, string> = {
    sick: "sick",
    flu: "sick",
    ill: "sick",
    unwell: "sick",
    covid: "sick",
    fever: "sick",
    injured: "sick",
    injury: "sick",
    hurt: "sick",
    doctor: "sick",
    hospital: "sick",
    medical: "sick",

    annual: "annual",
    holiday: "annual",
    vacation: "annual",
    break: "annual",
    weekend: "annual",
    family: "annual",
    personal: "annual",

    maternity: "maternity",
    pregnant: "maternity",
    pregnancy: "maternity",
    baby: "maternity",
    birth: "maternity",
    newborn: "maternity",

    paternity: "paternity",
    newfather: "paternity",

    compassionate: "compassionate",
    bereavement: "compassionate",
    funeral: "compassionate",
    death: "compassionate",
    passed: "compassionate",

    study: "study",
    course: "study",
    exam: "study",
    training: "study",
    education: "study",
    learning: "study",
  };

  for (const [keyword, type] of Object.entries(leaveTypeMap)) {
    if (lower.includes(keyword)) {
      details.leaveType = type;
      break;
    }
  }

  // ── Detect date references ─────────────────────────────────────────────
  const today_date = new Date(today);

  // Tomorrow
  if (lower.includes("tomorrow")) {
    const tomorrow = new Date(today_date);
    tomorrow.setDate(tomorrow.getDate() + 1);
    details.startDate = tomorrow.toISOString().split("T")[0];
  }

  // Today
  if (lower.includes("today")) {
    details.startDate = today;
  }

  // Next X day (Monday, Tuesday, etc.)
  const dayNames = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  for (let i = 0; i < dayNames.length; i++) {
    if (lower.includes(`next ${dayNames[i]}`) || lower.includes(`this ${dayNames[i]}`)) {
      const targetDate = new Date(today_date);
      const todayDay = today_date.getDay();
      let daysAhead = i + 1 - todayDay; // Monday = 1, Sunday = 0
      if (daysAhead <= 0) daysAhead += 7;
      targetDate.setDate(today_date.getDate() + daysAhead);
      details.startDate = targetDate.toISOString().split("T")[0];
      break;
    }
  }

  // Explicit date (YYYY-MM-DD) - search in full conversation
  const dateMatch = combinedText.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (dateMatch) {
    details.startDate = dateMatch[1];
  }

  // ── Detect number of days ──────────────────────────────────────────────
  const daysMatch = lower.match(/\b(\d{1,2})\s*(?:day|days|d)\b/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    if (days > 0 && days <= 365) {
      details.daysRequested = days;
      if (details.startDate) {
        const end = new Date(details.startDate);
        end.setDate(end.getDate() + days - 1);
        details.endDate = end.toISOString().split("T")[0];
      }
    }
  }

  // ── Detect medical certificate ─────────────────────────────────────────
  if (
    /have\s*(a\s*)?(medical\s*cert|doctor.*note|certificate|docs?|proof)/.test(lower) ||
    /with\s*(a\s*)?(medical|doctor|cert)/.test(lower)
  ) {
    details.hasMedicalCert = true;
  } else if (
    /no\s*(medical|cert|doctor|proof)|without\s*(medical|cert|doctor)/.test(lower)
  ) {
    details.hasMedicalCert = false;
  }

  // ── Detect emergency ───────────────────────────────────────────────────
  if (/emergency|urgent|asap|immediately|right away/.test(lower)) {
    details.isEmergency = true;
  }

  // ── Extract reason ─────────────────────────────────────────────────────
  // Try to find a clause after "because", "due to", "for", etc.
  const reasonPatterns = [
    /because\s+(.+?)(?:\.|$|,|and)/i,
    /due to\s+(.+?)(?:\.|$|,|and)/i,
    /for\s+(.+?)(?:\.|$|,|and)/i,
    /i'm?\s+(?:sick|ill|unwell|injured),?\s+(.+?)(?:\.|$)/i,
  ];

  for (const pattern of reasonPatterns) {
    const match = lower.match(pattern);
    if (match) {
      details.reason = match[1].trim();
      break;
    }
  }

  return details;
}

export default router;
