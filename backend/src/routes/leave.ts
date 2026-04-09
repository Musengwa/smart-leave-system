import { Router, Request, Response } from "express";
import { runDecisionEngine } from "../engine/index";
import { LeaveRequest } from "../engine/types";
import { getEmployeeById, saveLeaveRecord } from "../db/supabase";
import { buildOpeningMessage } from "../chat/openai";

const router = Router();

// ─── POST /leave/apply ────────────────────────────────────────────────────────
// Called when the employee submits the leave request form.
// Returns the engine decision + the first chat message.
// If REFER_HR, no chat session is started.

router.post("/apply", async (req: Request, res: Response) => {
  try {
    const {
      employeeId,
      leaveType,
      daysRequested,
      startDate,
      reason,
      hasMedicalCert,
      isEmergency,
    } = req.body;

    // ── Validate required fields ──────────────────────────────────────────
    if (!employeeId || !leaveType || !daysRequested || !startDate) {
      return res.status(400).json({
        error: "Missing required fields: employeeId, leaveType, daysRequested, startDate",
      });
    }

    // ── Pull employee from Supabase ───────────────────────────────────────
    const employee = await getEmployeeById(employeeId);
    if (!employee) {
      return res.status(404).json({ error: "Employee not found." });
    }

    // ── Build the request object ──────────────────────────────────────────
    const leaveRequest: LeaveRequest = {
      leaveType,
      daysRequested: Number(daysRequested),
      startDate,
      reason: reason ?? "",
      hasMedicalCert: hasMedicalCert ?? false,
      isEmergency: isEmergency ?? false,
    };

    // ── Run the decision engine ───────────────────────────────────────────
    const decision = runDecisionEngine(leaveRequest, employee);

    // ── REFER_HR: hard stop, no chat session ──────────────────────────────
    if (decision.decision === "REFER_HR") {
      await saveLeaveRecord({
        employeeId,
        request: leaveRequest,
        decision,
        finalDecision: "REFER_HR",
      });

      return res.status(200).json({
        status: "REFER_HR",
        decision,
        message:
          "Your request requires HR involvement. Please contact the HR department directly with your request details.",
        chatEnabled: false,
      });
    }

    // ── All other decisions: open a chat session ──────────────────────────
    // Save the initial record — chat may update the finalDecision later
    const record = await saveLeaveRecord({
      employeeId,
      request: leaveRequest,
      decision,
      chatTranscript: [],
    });

    // Build the first message from the AI
    const openingMessage = await buildOpeningMessage(employee, leaveRequest, decision);

    return res.status(200).json({
      status: decision.decision,
      decision,
      sessionId: record.id,   // frontend uses this to continue the chat
      chatEnabled: true,
      openingMessage,
    });

  } catch (error) {
    console.error("[POST /leave/apply]", error);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

export default router;
