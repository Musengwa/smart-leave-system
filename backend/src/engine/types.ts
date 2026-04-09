// ─── Leave Types ──────────────────────────────────────────────────────────────

export type LeaveType =
  | "annual"
  | "sick"
  | "maternity"
  | "paternity"
  | "compassionate"
  | "study";

export type DecisionStatus =
  | "APPROVED"
  | "DENIED"
  | "REFER_HR"
  | "PENDING_INFO";

// ─── Incoming Request (from the form) ────────────────────────────────────────

export interface LeaveRequest {
  leaveType: LeaveType;
  daysRequested: number;
  startDate: string;        // ISO date string e.g. "2025-06-01"
  reason: string;
  hasMedicalCert?: boolean; // relevant for sick leave
  isEmergency?: boolean;    // user can flag this on the form
}

// ─── Employee Profile (pulled from Supabase) ─────────────────────────────────

export interface EmployeeProfile {
  id: string;
  name: string;
  gender: "male" | "female" | "other";
  monthsWorked: number;     // total months at company
  leaveBalance: LeaveBalance;
}

export interface LeaveBalance {
  annual: number;
  sick: number;
  maternity: number;
  paternity: number;
  compassionate: number;
  study: number;
}

// ─── What every module returns ────────────────────────────────────────────────

export interface DecisionResult {
  decision: DecisionStatus;
  module: LeaveType;

  // How many days were actually approved (may differ from requested)
  daysApproved?: number;

  // Plain English reason — this gets handed to ChatGPT as context
  reason: string;

  // Specific flags for ChatGPT to act on
  flags: DecisionFlag[];

  // Whether new info from the chat can trigger a re-evaluation
  // Always false when decision is REFER_HR
  canOverride: boolean;

  // Any alternatives the engine itself can suggest
  // e.g. "You have 4 days available, consider splitting the request"
  suggestions?: string[];
}

// ─── Flags ────────────────────────────────────────────────────────────────────
// These tell ChatGPT *what to focus on* in the conversation

export type DecisionFlag =
  | "INSUFFICIENT_BALANCE"      // not enough days left
  | "NEEDS_MEDICAL_CERT"        // sick leave > 2 days, no cert provided
  | "INSUFFICIENT_SERVICE"      // e.g. maternity needs 2 years
  | "EXCEEDS_SINGLE_REQUEST_LIMIT" // too many days in one go
  | "GENDER_INELIGIBLE"         // e.g. male applying for maternity
  | "REQUIRES_DOCUMENTATION"    // study leave, maternity etc.
  | "PARTIAL_APPROVAL_POSSIBLE" // some days can be approved, not all
  | "EMERGENCY_FLAGGED";        // user marked as emergency

// ─── What gets stored in Supabase after a decision ───────────────────────────

export interface LeaveRecord {
  id?: string;                  // assigned by Supabase
  employeeId: string;
  request: LeaveRequest;
  decision: DecisionResult;
  chatTranscript?: ChatMessage[];
  finalDecision?: DecisionStatus; // may differ if chat changed outcome
  createdAt?: string;
}

// ─── Chat types ───────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatContext {
  employee: EmployeeProfile;
  request: LeaveRequest;
  decision: DecisionResult;
  history: ChatMessage[];
}
