// src/services/leaveService.ts
// Connects the LeaveRequest form and AIChat to the backend API

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LeaveRequestPayload {
  employeeId: string;
  leaveType: string;
  daysRequested: number;
  startDate: string;
  reason: string;
  hasMedicalCert?: boolean;
  isEmergency?: boolean;
}

export interface DecisionResult {
  decision: "APPROVED" | "DENIED" | "REFER_HR" | "PENDING_INFO";
  module: string;
  daysApproved?: number;
  reason: string;
  flags: string[];
  canOverride: boolean;
  suggestions?: string[];
}

export interface ApplyLeaveResponse {
  status: string;
  decision: DecisionResult;
  sessionId?: string;       // present when chatEnabled is true
  chatEnabled: boolean;
  openingMessage?: string;  // first AI message when chatEnabled is true
  message?: string;         // present when REFER_HR
}

export interface ChatResponse {
  reply: string;
  decision: DecisionResult;
  decisionChanged: boolean;
  chatEnabled: boolean;
}

// ─── Calculate days between two date strings ─────────────────────────────────

export function calculateDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

// ─── Submit leave request form → runs decision engine → opens chat ────────────

export async function submitLeaveRequest(
  payload: LeaveRequestPayload
): Promise<ApplyLeaveResponse> {
  const res = await fetch(`${API_BASE}/leave/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`[${res.status}] ${data.error || "Failed to submit leave request"}`);
  }

  return data;
}

// ─── Send a chat message in an existing session ───────────────────────────────

export async function sendChatMessage(
  sessionId: string,
  message: string
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/chat/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, message }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`[${res.status}] ${data.error || "Failed to send message"}`);
  }

  return data;
}

// ─── Load chat history for an existing session (e.g. on page refresh) ────────

export async function getChatHistory(sessionId: string) {
  const res = await fetch(`${API_BASE}/chat/history/${sessionId}`);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(`[${res.status}] ${data.error || "Failed to load chat history"}`);
  }

  return data;
}
