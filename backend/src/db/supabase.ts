import { createClient } from "@supabase/supabase-js";
import { EmployeeProfile, LeaveRecord } from "../engine/types";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

interface EmployeeRow {
  id: string;
  name: string;
  gender: "male" | "female" | "other";
  hire_date: string;
  balance_annual: number;
  balance_sick: number;
  balance_maternity: number;
  balance_paternity: number;
  balance_compassionate: number;
  balance_study: number;
}

interface LeaveRecordRow {
  id: string;
  employee_id: string;
  request: LeaveRecord["request"];
  decision: LeaveRecord["decision"];
  final_decision: LeaveRecord["finalDecision"] | null;
  chat_transcript: LeaveRecord["chatTranscript"] | null;
  created_at: string;
}

function monthsWorkedFromHireDate(hireDate: string): number {
  const start = new Date(hireDate);
  if (Number.isNaN(start.getTime())) return 0;

  const now = new Date();
  const years = now.getUTCFullYear() - start.getUTCFullYear();
  const months = now.getUTCMonth() - start.getUTCMonth();
  let total = years * 12 + months;

  if (now.getUTCDate() < start.getUTCDate()) {
    total -= 1;
  }

  return Math.max(total, 0);
}

function mapEmployeeRow(row: EmployeeRow): EmployeeProfile {
  return {
    id: row.id,
    name: row.name,
    gender: row.gender,
    monthsWorked: monthsWorkedFromHireDate(row.hire_date),
    leaveBalance: {
      annual: row.balance_annual,
      sick: row.balance_sick,
      maternity: row.balance_maternity,
      paternity: row.balance_paternity,
      compassionate: row.balance_compassionate,
      study: row.balance_study,
    },
  };
}

function mapLeaveRecordRow(row: LeaveRecordRow): LeaveRecord {
  return {
    id: row.id,
    employeeId: row.employee_id,
    request: row.request,
    decision: row.decision,
    chatTranscript: row.chat_transcript ?? [],
    finalDecision: row.final_decision ?? undefined,
    createdAt: row.created_at,
  };
}

export async function getEmployeeById(id: string): Promise<EmployeeProfile | null> {
  if (!id) return null;

  const { data, error } = await supabase
    .from("employees")
    .select(
      `
      id,
      name,
      gender,
      hire_date,
      balance_annual,
      balance_sick,
      balance_maternity,
      balance_paternity,
      balance_compassionate,
      balance_study
      `,
    )
    .eq("id", id)
    .maybeSingle<EmployeeRow>();

  if (error || !data) return null;
  return mapEmployeeRow(data);
}

export async function getLeaveRecord(id: string): Promise<LeaveRecord | null> {
  if (!id) return null;

  const { data, error } = await supabase
    .from("leave_records")
    .select("*")
    .eq("id", id)
    .maybeSingle<LeaveRecordRow>();

  if (error || !data) return null;
  return mapLeaveRecordRow(data);
}

export async function saveLeaveRecord(
  record: Omit<LeaveRecord, "id" | "createdAt">,
): Promise<LeaveRecord> {
  const { data, error } = await supabase
    .from("leave_records")
    .insert({
      employee_id: record.employeeId,
      request: record.request,
      decision: record.decision,
      final_decision: record.finalDecision ?? null,
      chat_transcript: record.chatTranscript ?? [],
      leave_type: record.request.leaveType,
      days_requested: record.request.daysRequested,
      days_approved: record.decision.daysApproved ?? null,
      start_date: record.request.startDate,
    })
    .select("*")
    .single<LeaveRecordRow>();

  if (error || !data) {
    throw new Error(`Failed to save leave record: ${error?.message ?? "Unknown error"}`);
  }

  return mapLeaveRecordRow(data);
}

export async function updateLeaveRecord(
  id: string,
  updates: Partial<LeaveRecord>,
): Promise<void> {
  const { error } = await supabase
    .from("leave_records")
    .update({
      ...(updates.request !== undefined && {
        request: updates.request,
        leave_type: updates.request.leaveType,
        days_requested: updates.request.daysRequested,
        start_date: updates.request.startDate,
      }),
      ...(updates.chatTranscript !== undefined && { chat_transcript: updates.chatTranscript }),
      ...(updates.decision !== undefined && {
        decision: updates.decision,
        days_approved: updates.decision.daysApproved ?? null,
      }),
      ...(updates.finalDecision !== undefined && { final_decision: updates.finalDecision }),
    })
    .eq("id", id);

  if (error) throw new Error(`Failed to update leave record: ${error.message}`);
}
