import { Router, Request, Response } from "express";
import { runDecisionEngine } from "../engine/index";
import { LeaveRequest } from "../engine/types";
import { getEmployeeById, saveLeaveRecord } from "../db/supabase";
import { buildOpeningMessage } from "../chat/openai";

const router = Router();

// ─── POST /leave/apply ────────────────────────────────────────────────────────

router.post("/apply", async (req: Request, res: Response) => {
  try {
    const {
      employeeId,
      leaveType,
      daysRequested,
      startDate,
      endDate,       // now required for calendar checks
      reason,
      hasMedicalCert,
      isEmergency,
    } = req.body;

    if (!employeeId || !leaveType || !daysRequested || !startDate) {
      return res.status(400).json({
        error: "Missing required fields: employeeId, leaveType, daysRequested, startDate",
      });
    }

    const employee = await getEmployeeById(employeeId);
    if (!employee) {
      return res.status(404).json({ error: "Employee not found." });
    }

    const leaveRequest: LeaveRequest = {
      leaveType,
      daysRequested: Number(daysRequested),
      startDate,
      endDate:        endDate ?? startDate,  // fallback to startDate if not provided
      reason:         reason ?? "",
      hasMedicalCert: hasMedicalCert ?? false,
      isEmergency:    isEmergency ?? false,
    };

    // Engine now async (runs calendar check inside)
    const decision = await runDecisionEngine(leaveRequest, employee);

    // REFER_HR — hard stop
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
        message: "Your request requires HR involvement. Please contact the HR department directly.",
        chatEnabled: false,
      });
    }

    // All other decisions — open chat
    const record = await saveLeaveRecord({
      employeeId,
      request: leaveRequest,
      decision,
      chatTranscript: [],
    });

    const openingMessage = await buildOpeningMessage(employee, leaveRequest, decision);

    return res.status(200).json({
      status: decision.decision,
      decision,
      sessionId: record.id,
      chatEnabled: true,
      openingMessage,
    });

  } catch (error) {
    console.error("[POST /leave/apply]", error);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

export default router;
