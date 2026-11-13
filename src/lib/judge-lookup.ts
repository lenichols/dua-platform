import type { SupabaseClient } from "@supabase/supabase-js";

export type JudgeRow = {
  id: string;
  name: string;
  is_active: boolean;
  role: "judge" | "mentor";
};

/**
 * Look up a judge/mentor row by auth user id. Resilient to the `role` column
 * not yet existing (pre-0002 migration): if Supabase complains about a missing
 * column, retry without `role` and default to `'judge'`. This means the app
 * keeps working between deploying new code and applying the migration.
 */
export async function getJudgeByAuthUser(
  supabase: SupabaseClient,
  authUserId: string,
): Promise<JudgeRow | null> {
  const { data, error } = await supabase
    .from("judges")
    .select("id, name, is_active, role")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!error) {
    if (!data) return null;
    return {
      id: data.id,
      name: data.name,
      is_active: data.is_active,
      role: (data.role as "judge" | "mentor") ?? "judge",
    };
  }

  // Probable cause: `role` column doesn't exist yet. Retry without it.
  const { data: fallback } = await supabase
    .from("judges")
    .select("id, name, is_active")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (!fallback) return null;
  return {
    id: fallback.id,
    name: fallback.name,
    is_active: fallback.is_active,
    role: "judge",
  };
}
