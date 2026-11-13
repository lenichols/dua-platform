import { createClient } from "@/lib/supabase/server";

export type Phase = "submissions" | "judging" | "results";

export async function getPhase(): Promise<Phase> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("event_state")
      .select("phase")
      .eq("id", 1)
      .maybeSingle();
    return (data?.phase as Phase) ?? "submissions";
  } catch {
    return "submissions";
  }
}

// Whether the project submission form is open. Admin-controlled, separate from
// phase; defaults to false (closed) so /submit stays locked until opened.
export async function getSubmissionsOpen(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("event_state")
      .select("submissions_open")
      .eq("id", 1)
      .maybeSingle();
    return data?.submissions_open === true;
  } catch {
    return false;
  }
}

// Whether participant registration and mentor sign-up are open.
// Admin-controlled, like submissions_open; both forms also close once the
// phase leaves "submissions". Defaults to false (closed).
export async function getRegistrationOpen(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("event_state")
      .select("registration_open")
      .eq("id", 1)
      .maybeSingle();
    return data?.registration_open === true;
  } catch {
    return false;
  }
}
