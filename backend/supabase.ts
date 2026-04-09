import { createClient } from "@supabase/supabase-js";
import { EmployeeProfile, LeaveRecord } from "./src/engine/types";

// ─── Client ───────────────────────────────────────────────────────────────────
// Set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file

const supabase = createClient(
  import.meta.env.SUPABASE_URL!,
  import.meta.env.SUPABASE_ANON_KEY!
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

  if (error || !data) return null;
  return data as EmployeeProfile;
}

// ─── Leave record queries ─────────────────────────────────────────────────────

export async function saveLeaveRecord(
  record: Omit<LeaveRecord, "id" | "createdAt">
): Promise<LeaveRecord> {
  const { data, error } = await supabase
    .from("leave_records")
    .insert({ ...record, createdAt: new Date().toISOString() })
    .select()
    .single();

  if (error || !data) throw new Error(`Failed to save leave record: ${error?.message}`);
  return data as LeaveRecord;
}

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

export async function updateLeaveRecord(
  id: string,
  updates: Partial<LeaveRecord>
): Promise<void> {
  const { error } = await supabase
    .from("leave_records")
    .update(updates)
    .eq("id", id);

  if (error) throw new Error(`Failed to update leave record: ${error.message}`);
}
