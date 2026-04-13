import { createClient } from "@supabase/supabase-js";
import { EmployeeProfile, LeaveRecord } from "../engine/types";

// ─── Client ───────────────────────────────────────────────────────────────────
// Set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// ─── Employee queries ─────────────────────────────────────────────────────────

export async function getEmployeeById(
  id: string
): Promise<EmployeeProfile | null> {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("id", id)
    .single();

  console.log("Supabase response:", { data, error }); // ← add this line

  if (error || !data) return null;
 return {
    id: data.id,
    name: data.name,
    gender: data.gender,
    monthsWorked: data.months_worked,
    leaveBalance: {
      annual:        data.balance_annual,
      sick:          data.balance_sick,
      maternity:     data.balance_maternity,
      paternity:     data.balance_paternity,
      compassionate: data.balance_compassionate,
      study:         data.balance_study,
    },
  };
  
  return data as EmployeeProfile;
}

// ─── Leave record queries ─────────────────────────────────────────────────────
export async function getLeaveRecord(
  id: string
): Promise<LeaveRecord | null> {
  const { data, error } = await supabase
    .from("leave_records")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as LeaveRecord;
}

export async function saveLeaveRecord(
  record: Omit<LeaveRecord, "id" | "createdAt">
): Promise<LeaveRecord> {
  const { data, error } = await supabase
    .from("leave_records")
    .insert({
      employee_id:      record.employeeId,
      request:          record.request,
      decision:         record.decision,
      final_decision:   record.finalDecision ?? null,
      chat_transcript:  record.chatTranscript ?? [],
      leave_type:       record.request.leaveType,
      days_requested:   record.request.daysRequested,
      days_approved:    record.decision.daysApproved ?? null,
      start_date:       record.request.startDate,
    })
    .select()
    .single();

  if (error || !data) throw new Error(`Failed to save leave record: ${error?.message}`);
  return data as LeaveRecord;
}

export async function updateLeaveRecord(
  id: string,
  updates: Partial<LeaveRecord>
): Promise<void> {
  const { error } = await supabase
    .from("leave_records")
    .update({
      ...(updates.chatTranscript !== undefined && { chat_transcript: updates.chatTranscript }),
      ...(updates.decision       !== undefined && { decision:        updates.decision }),
      ...(updates.finalDecision  !== undefined && { final_decision:  updates.finalDecision }),
    })
    .eq("id", id);

  if (error) throw new Error(`Failed to update leave record: ${error.message}`);
}