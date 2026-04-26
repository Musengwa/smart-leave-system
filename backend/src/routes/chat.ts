import { Router, Request, Response } from "express";
import { sendChatMessage } from "../chat/openai";
import { ChatContext } from "../engine/types";
import { getLeaveRecord, updateLeaveRecord, getEmployeeById } from "../db/supabase";

const router = Router();

// ─── POST /chat/message ───────────────────────────────────────────────────────
// Called every time the user sends a message in the chat interface.
// Manages conversation history and handles any re-evaluations.

router.post("/message", async (req: Request, res: Response) => {
  try {
    const { sessionId, message } = req.body;

    // ── Validate ──────────────────────────────────────────────────────────
    if (!sessionId || !message?.trim()) {
      return res.status(400).json({
        error: "Missing required fields: sessionId, message",
      });
    }

    // ── Load the leave record (contains request, decision, history) ───────
    const record = await getLeaveRecord(sessionId);
    if (!record) {
      return res.status(404).json({ error: "Session not found." });
    }

    // ── Guard: REFER_HR sessions should never reach chat ──────────────────
    if (record.decision.decision === "REFER_HR") {
      return res.status(403).json({
        error: "This session has been referred to HR. Chat is not available.",
      });
    }

    // ── Load employee profile ─────────────────────────────────────────────
    const employee = await getEmployeeById(record.employeeId);
    if (!employee) {
      return res.status(404).json({ error: "Employee not found." });
    }

    // ── Build the chat context ────────────────────────────────────────────
    const context: ChatContext = {
      employee,
      request: record.request,
      decision: record.decision,
      history: record.chatTranscript ?? [],
    };

    // ── Send message to OpenAI, get reply + updated context ───────────────
    const { reply, updatedContext } = await sendChatMessage(message, context);

    // ── Detect if the engine changed its decision during this turn ────────
    const decisionChanged =
      updatedContext.decision.decision !== record.decision.decision;

    // ── Persist updated transcript and decision back to Supabase ─────────
    await updateLeaveRecord(sessionId, {
      request: updatedContext.request,
      chatTranscript: updatedContext.history,
      decision: updatedContext.decision,
      // Only stamp finalDecision once the conversation reaches a firm state
      ...(decisionChanged && { finalDecision: updatedContext.decision.decision }),
    });

    return res.status(200).json({
      reply,
      decision: updatedContext.decision,
      decisionChanged,
      // If the decision just flipped to REFER_HR mid-chat, tell the frontend
      chatEnabled: updatedContext.decision.decision !== "REFER_HR",
    });

  } catch (error) {
    console.error("[POST /chat/message]", error);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// ─── GET /chat/history/:sessionId ────────────────────────────────────────────
// Lets the frontend reload a conversation (e.g. on page refresh)

router.get("/history/:sessionId", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const record = await getLeaveRecord(sessionId);
    if (!record) {
      return res.status(404).json({ error: "Session not found." });
    }

    return res.status(200).json({
      history: record.chatTranscript ?? [],
      decision: record.decision,
      request: record.request,
    });

  } catch (error) {
    console.error("[GET /chat/history]", error);
    return res.status(500).json({ error: "Something went wrong." });
  }
});

export default router;

