// Which sample logins to offer on a sign-in page. Empty unless demo mode is
// on, and then only for sample accounts that exist, are active and still
// have the sample password, so the page never advertises a login that fails.

import { findAdminUserByEmail } from "@/lib/admin-users";
import { verifyAdminPassword } from "@/lib/admin-password";
import { DEMO_ADMIN, DEMO_JUDGE, DEMO_MENTOR, demoMode, type SampleLogin } from "@/lib/demo";
import { verifyJudgeSignIn } from "./judges";

export async function sampleJudgeLogins(eventId: string): Promise<SampleLogin[]> {
  if (!demoMode()) return [];
  const found: SampleLogin[] = [];
  for (const login of [DEMO_JUDGE, DEMO_MENTOR]) {
    if (await verifyJudgeSignIn(eventId, login.email, login.password)) found.push(login);
  }
  return found;
}

export async function sampleAdminLogins(): Promise<SampleLogin[]> {
  if (!demoMode()) return [];
  const lookup = await findAdminUserByEmail(DEMO_ADMIN.email);
  if (!lookup.ok || !lookup.user?.is_active) return [];
  const matches = await verifyAdminPassword(DEMO_ADMIN.password, lookup.user.password_hash);
  if (!matches) return [];
  // Say what this account can actually do: it may be read-only.
  const readOnly = lookup.user.role === "viewer";
  return [{ ...DEMO_ADMIN, can: readOnly ? "Looks around, can't change anything" : DEMO_ADMIN.can }];
}
