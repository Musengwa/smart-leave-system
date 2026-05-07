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
  startDate: string;
  endDate?: string;         // used for calendar checks
  reason: string;
  hasMedicalCert?: boolean;
  isEmergency?: boolean;
}

// ─── Employee Profile (pulled from Supabase) ─────────────────────────────────

export interface EmployeeProfile {
  id: string;
  name: string;
  gender: "male" | "female" | "other";
  monthsWorked: number;
  department?: string;      // used for department-specific blackout checks
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
  daysApproved?: number;
  reason: string;
  flags: DecisionFlag[];
  canOverride: boolean;
  suggestions?: string[];
  calendarResult?: any;     // attached by engine after calendar check
}

// ─── Flags ────────────────────────────────────────────────────────────────────

export type DecisionFlag =
  | "INSUFFICIENT_BALANCE"
  | "NEEDS_MEDICAL_CERT"
  | "INSUFFICIENT_SERVICE"
  | "EXCEEDS_SINGLE_REQUEST_LIMIT"
  | "GENDER_INELIGIBLE"
  | "REQUIRES_DOCUMENTATION"
  | "PARTIAL_APPROVAL_POSSIBLE"
  | "EMERGENCY_FLAGGED"
  // Calendar flags
  | "BLACKOUT_HARD"
  | "BLACKOUT_SOFT"
  | "HIGH_TEAM_CONFLICT"
  | "MEDIUM_TEAM_CONFLICT"
  | "CONTAINS_PUBLIC_HOLIDAYS"
  | "FULL_PERIOD_IS_HOLIDAYS";

// ─── Supabase record ─────────────────────────────────────────────────────────

export interface LeaveRecord {
  id?: string;
  employeeId: string;
  request: LeaveRequest;
  decision: DecisionResult;
  chatTranscript?: ChatMessage[];
  finalDecision?: DecisionStatus;
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
