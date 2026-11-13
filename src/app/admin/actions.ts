"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  checkAdminPassword,
  clearAdminCookie,
  issueAdminCookie,
  issueAdminCookieForUser,
  requireAdmin,
  requireSuperAdmin,
  requireTeamAccess,
  requireWriteAccess,
  sessionLabel,
} from "./auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  countOtherActiveOwners,
  countOtherActiveSuperAdmins,
  createAdminUser,
  deleteAdminUser,
  findAdminUserByEmail,
  findAdminUserById,
  getAdminUserById,
  setAdminUserPassword,
  touchAdminLastLogin,
  updateAdminUser,
} from "@/lib/admin-users";
import {
  MIN_ADMIN_PASSWORD_LENGTH,
  generateAdminPassword,
  verifyAdminPassword,
} from "@/lib/admin-password";
import { ADMIN_ROLES, type AdminRole } from "@/lib/admin-roles";
import {
  htmlToText,
  renderCampaignEmail,
  resendConfigured,
  sanitizeCampaignHtml,
  sendBatch,
  sendOne,
  siteUrl,
} from "@/lib/email";
import {
  countAudience,
  createCampaign,
  finalizeCampaign,
  isAdminAudience,
  loadRecipients,
  parseAudience,
} from "@/lib/campaigns";
import { unsubscribeUrl } from "@/lib/unsubscribe";
import {
  drawBubble,
  monteCarloTop,
  type ScoreRow,
  type SubmissionMeta,
} from "@/lib/monte-carlo";

// ── sign in / out ────────────────────────────────────────────────
export async function signInAdmin(_: unknown, form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const pw = String(form.get("password") ?? "");

  // Individual accounts first, so a teammate's own role is what they get.
  if (email) {
    const lookup = await findAdminUserByEmail(email);
    if (lookup.ok && lookup.user) {
      const user = lookup.user;
      if (await verifyAdminPassword(pw, user.password_hash)) {
        if (!user.is_active) {
          return {
            ok: false as const,
            error: "That account has been deactivated. Ask an owner to re-enable it.",
          };
        }
        await touchAdminLastLogin(user.id);
        await issueAdminCookieForUser(user.id);
        redirect("/admin");
      }
      // Wrong per-account password — fall through to the shared-password
      // check below, so break-glass works whether or not the email box is
      // filled in. Otherwise typing your email + the shared password fails
      // for no reason a user can see.
    }
  }

  // Fall back to the shared ADMIN_PASSWORD (owner-level break-glass). This is
  // how the first account gets created, and how you get in if the
  // admin_users migration hasn't been run yet.
  if (checkAdminPassword(pw)) {
    await issueAdminCookie();
    redirect("/admin");
  }

  return { ok: false as const, error: "Wrong email or password." };
}

export async function signOutAdmin() {
  await clearAdminCookie();
  redirect("/");
}

// ── phase toggle ─────────────────────────────────────────────────
export async function setPhase(
  phase: "submissions" | "judging" | "results",
): Promise<
  | { ok: true; persisted: string; rowsAffected: number }
  | { ok: false; error: string }
> {
  const guard = await requireWriteAccess();
  if (!guard.ok) return { ok: false, error: guard.error };
  const admin = createAdminClient();

  // Update + return the affected row(s) so we can verify the write actually
  // persisted (not silently no-op'd by RLS or row mismatch).
  const { data: updated, error } = await admin
    .from("event_state")
    .update({
      phase,
      closed_at: phase === "results" ? new Date().toISOString() : null,
    })
    .eq("id", 1)
    .select("phase");

  if (error) {
    console.error("setPhase: update failed", error);
    return { ok: false, error: `DB error: ${error.message}` };
  }

  const rowsAffected = updated?.length ?? 0;
  if (rowsAffected === 0) {
    // No row with id=1 — try to insert one. The schema has `default 1` and
    // a check constraint, so this single-row table may need bootstrapping
    // in some environments.
    const { error: insErr } = await admin.from("event_state").upsert(
      {
        id: 1,
        phase,
        closed_at: phase === "results" ? new Date().toISOString() : null,
      },
      { onConflict: "id" },
    );
    if (insErr) {
      console.error("setPhase: upsert failed", insErr);
      return {
        ok: false,
        error: `Update affected 0 rows; upsert also failed: ${insErr.message}`,
      };
    }
  }

  // Read back to confirm what's actually in the DB now.
  const { data: after } = await admin
    .from("event_state")
    .select("phase")
    .eq("id", 1)
    .maybeSingle();

  revalidatePath("/", "layout");
  revalidatePath("/admin");
  return {
    ok: true,
    persisted: String(after?.phase ?? "(unknown)"),
    rowsAffected,
  };
}

// ── judge / mentor roster ────────────────────────────────────────
export async function addJudge(_: unknown, form: FormData) {
  const guard = await requireWriteAccess();
  if (!guard.ok) return { ok: false as const, error: guard.error };
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const roleRaw = String(form.get("role") ?? "judge").trim().toLowerCase();
  const role = roleRaw === "mentor" ? "mentor" : "judge";
  if (!name || !email) return { ok: false as const, error: "Name and email required" };

  const admin = createAdminClient();

  // Create auth user (passwordless — magic links only)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  let authUserId = created?.user?.id;
  if (createErr && !authUserId) {
    // Maybe already exists — look them up
    const { data: found } = await admin.auth.admin.listUsers();
    authUserId = found?.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (!authUserId)
      return { ok: false as const, error: `Couldn't create ${role}: ${createErr.message}` };
  }

  const { error } = await admin.from("judges").upsert(
    {
      auth_user_id: authUserId!,
      name,
      email,
      role,
      is_active: true,
    },
    { onConflict: "email" },
  );
  if (error) {
    // Likely cause: 0002_mentors migration not applied yet, so `role` column
    // doesn't exist. Fall back to inserting without `role` — but only if
    // we're trying to add a regular judge. Mentors require the migration.
    const isMissingColumn = /column .*role.* does not exist/i.test(error.message);
    if (isMissingColumn && role === "judge") {
      const retry = await admin.from("judges").upsert(
        {
          auth_user_id: authUserId!,
          name,
          email,
          is_active: true,
        },
        { onConflict: "email" },
      );
      if (retry.error) return { ok: false as const, error: retry.error.message };
      revalidatePath("/admin");
      return { ok: true as const };
    }
    if (isMissingColumn && role === "mentor") {
      return {
        ok: false as const,
        error:
          "Mentors require the 0002_mentors migration. Run supabase/migrations/0002_mentors.sql in the Supabase SQL Editor first.",
      };
    }
    return { ok: false as const, error: error.message };
  }
  revalidatePath("/admin");
  return { ok: true as const };
}

export async function removeJudge(
  judgeId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireWriteAccess();
  if (!guard.ok) return { ok: false, error: guard.error };
  const admin = createAdminClient();
  const { error } = await admin
    .from("judges")
    .update({ is_active: false })
    .eq("id", judgeId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

// ── registrations ────────────────────────────────────────────────
export async function deleteRegistration(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireWriteAccess();
  if (!guard.ok) return { ok: false, error: guard.error };
  const admin = createAdminClient();
  const { error } = await admin.from("registrations").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

// ── registration open/close (participants + mentors) ────────────
export async function setRegistrationOpen(
  open: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireWriteAccess();
  if (!guard.ok) return { ok: false, error: guard.error };
  const admin = createAdminClient();
  const { error } = await admin
    .from("event_state")
    .update({ registration_open: open })
    .eq("id", 1);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  revalidatePath("/admin");
  return { ok: true };
}

// ── submission form open/close ──────────────────────────────────
export async function setSubmissionsOpen(
  open: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireWriteAccess();
  if (!guard.ok) return { ok: false, error: guard.error };
  const admin = createAdminClient();
  const { error } = await admin
    .from("event_state")
    .update({ submissions_open: open })
    .eq("id", 1);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  revalidatePath("/admin");
  return { ok: true };
}

// ── shared password for all judges (bypasses email rate limits) ──
export async function setSharedJudgePassword(
  _: unknown,
  form: FormData,
): Promise<
  | { ok: true; updated: number; failed: number; details: string[] }
  | { ok: false; error: string }
> {
  const guard = await requireWriteAccess();
  if (!guard.ok) return { ok: false, error: guard.error };
  const password = String(form.get("password") ?? "").trim();
  if (password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters" };
  }
  const admin = createAdminClient();
  const { data: judges, error } = await admin
    .from("judges")
    .select("id, auth_user_id, email")
    .eq("is_active", true);
  if (error) return { ok: false, error: error.message };

  let updated = 0;
  let failed = 0;
  const details: string[] = [];

  for (const j of judges ?? []) {
    const email = String(j.email ?? "").toLowerCase();
    if (!email) {
      failed++;
      details.push(`(no email on judge ${j.id})`);
      continue;
    }

    // Look up auth user by email — more reliable than the stored
    // auth_user_id, which can be null or stale.
    let authId = await findAuthUserIdByEmail(admin, email);

    // If still no auth user, create one
    if (!authId) {
      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({
          email,
          email_confirm: true,
          password,
        });
      if (createErr || !created?.user?.id) {
        failed++;
        details.push(`${email}: couldn't create auth user (${createErr?.message ?? "unknown"})`);
        continue;
      }
      authId = created.user.id;
    } else {
      // Existing auth user — explicitly set password AND re-confirm email
      const { error: updErr } = await admin.auth.admin.updateUserById(authId, {
        password,
        email_confirm: true,
      });
      if (updErr) {
        failed++;
        details.push(`${email}: ${updErr.message}`);
        continue;
      }
    }

    // Make sure judges.auth_user_id matches what's in auth.users
    if (j.auth_user_id !== authId) {
      await admin
        .from("judges")
        .update({ auth_user_id: authId })
        .eq("id", j.id);
    }
    updated++;
  }
  revalidatePath("/admin");
  return { ok: true, updated, failed, details };
}

// ── diagnose sign-in — pinpoints exactly why a judge can't log in ──
export async function diagnoseJudgeSignIn(
  _: unknown,
  form: FormData,
): Promise<
  | {
      ok: true;
      authUserExists: boolean;
      authUserId: string | null;
      emailConfirmedAt: string | null;
      hasJudgeRow: boolean;
      isActive: boolean | null;
      signInResult: "success" | "failed";
      signInError: string | null;
    }
  | { ok: false; error: string }
> {
  const guard = await requireWriteAccess();
  if (!guard.ok) return { ok: false, error: guard.error };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { ok: false, error: "Email + password required" };

  const admin = createAdminClient();

  // 1. Find auth user
  let authUserExists = false;
  let authUserId: string | null = null;
  let emailConfirmedAt: string | null = null;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data) break;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) {
      authUserExists = true;
      authUserId = hit.id;
      emailConfirmedAt = hit.email_confirmed_at ?? null;
      break;
    }
    if (data.users.length < 200) break;
  }

  // 2. Find judges row
  const { data: judgeRow } = await admin
    .from("judges")
    .select("id, is_active")
    .eq("email", email)
    .maybeSingle();
  const hasJudgeRow = !!judgeRow;
  const isActive = judgeRow?.is_active ?? null;

  // 3. Attempt actual sign-in via the public anon client (the same path the
  //    browser uses). This tells us exactly what Supabase says.
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { createClient: createAnonClient } = await import("@supabase/supabase-js");
  const anon = createAnonClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, anonKey!);
  const { data: signed, error: signErr } = await anon.auth.signInWithPassword({
    email,
    password,
  });
  const signInResult: "success" | "failed" = signed?.user ? "success" : "failed";

  return {
    ok: true,
    authUserExists,
    authUserId,
    emailConfirmedAt,
    hasJudgeRow,
    isActive,
    signInResult,
    signInError: signErr?.message ?? null,
  };
}

// ── one-off test account with a known password ──────────────────

// Paginated lookup — auth.admin.listUsers only returns 50/page, so a single
// call misses users on later pages.
async function findAuthUserIdByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<string | null> {
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error || !data) return null;
    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit.id;
    if (data.users.length < 200) return null; // last page
  }
  return null;
}

export async function createTestJudge(
  _: unknown,
  form: FormData,
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const guard = await requireWriteAccess();
  if (!guard.ok) return { ok: false, error: guard.error };
  const name = String(form.get("name") ?? "").trim() || "Test Judge";
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "").trim();
  const roleRaw = String(form.get("role") ?? "judge").trim().toLowerCase();
  const role = roleRaw === "mentor" ? "mentor" : "judge";

  if (!email) return { ok: false, error: "Email required" };
  if (password.length < 6)
    return { ok: false, error: "Password must be at least 6 characters" };

  const admin = createAdminClient();

  // Two-step: ensure auth user exists, then explicitly set password +
  // email_confirm via updateUserById. More reliable than passing the password
  // to createUser (which can silently no-op in some edge cases).
  let authUserId = await findAuthUserIdByEmail(admin, email);
  if (!authUserId) {
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        email_confirm: true,
      });
    if (createErr || !created?.user?.id) {
      // Race: maybe it was created concurrently — retry lookup
      const retryId = await findAuthUserIdByEmail(admin, email);
      if (!retryId) {
        console.error("createTestJudge: createUser failed", createErr);
        return {
          ok: false,
          error: `Couldn't create auth user: ${createErr?.message ?? "unknown"}`,
        };
      }
      authUserId = retryId;
    } else {
      authUserId = created.user.id;
    }
  }

  const { error: pwdErr } = await admin.auth.admin.updateUserById(authUserId, {
    password,
    email_confirm: true,
  });
  if (pwdErr) {
    console.error("createTestJudge: updateUserById failed", pwdErr);
    return { ok: false, error: `Couldn't set password: ${pwdErr.message}` };
  }

  // Upsert into judges table (try with role; fall back if column missing)
  const { error } = await admin.from("judges").upsert(
    { auth_user_id: authUserId, name, email, role, is_active: true },
    { onConflict: "email" },
  );
  if (error) {
    if (/column .*role.* does not exist/i.test(error.message) && role === "judge") {
      const retry = await admin.from("judges").upsert(
        { auth_user_id: authUserId, name, email, is_active: true },
        { onConflict: "email" },
      );
      if (retry.error) return { ok: false, error: retry.error.message };
    } else {
      return { ok: false, error: error.message };
    }
  }
  revalidatePath("/admin");
  return { ok: true, email };
}

export async function toggleHideSubmission(
  id: string,
  hidden: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireWriteAccess();
  if (!guard.ok) return { ok: false, error: guard.error };
  const admin = createAdminClient();
  const { error } = await admin
    .from("submissions")
    .update({ hidden_from_judges: hidden })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

// ── top-6 compute + lock ─────────────────────────────────────────
export async function computeAndLockTop6(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireWriteAccess();
  if (!guard.ok) return { ok: false, error: guard.error };
  const admin = createAdminClient();

  const seedInput = formData.get("seed");
  const seed =
    seedInput && String(seedInput).length > 0
      ? Number.parseInt(String(seedInput), 10)
      : Date.now();

  // Only scores on the current rubric (0020); rows from earlier
  // rubrics have no sustainability score and are on a different scale.
  const { data: scores } = await admin
    .from("scores")
    .select("judge_id, submission_id, impact, innovation, sustainability, feasibility, scalability")
    .not("sustainability", "is", null);
  const { data: subs } = await admin
    .from("submissions")
    .select("id, project_name")
    .eq("hidden_from_judges", false)
    .eq("is_submission_complete", true);

  if (!scores || !subs)
    return { ok: false, error: "Couldn't load scores/submissions" };

  const mc = monteCarloTop(scores as ScoreRow[], subs as SubmissionMeta[], {
    seed,
    trials: 1000,
    topN: 6,
  });

  const slotsLeft = 6 - mc.autoLocked.length;
  const drawn = drawBubble(mc.bubble, mc.rankings, slotsLeft, seed);

  const chosen = [...mc.autoLocked, ...drawn].slice(0, 6);
  const top6 = chosen.map((sid, i) => {
    const r = mc.rankings.find((r) => r.submission_id === sid);
    return {
      submission_id: sid,
      rank: i + 1,
      probability: r?.p_top_n ?? 0,
    };
  });

  await admin.from("results_lock").upsert(
    { id: 1, seed, top6 },
    { onConflict: "id" },
  );
  await admin
    .from("event_state")
    .update({ phase: "results", closed_at: new Date().toISOString() })
    .eq("id", 1);

  revalidatePath("/admin");
  revalidatePath("/results", "layout");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function recordTieBreak(
  winnerId: string,
  loserId: string,
  reason: string,
  decidedBy: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireWriteAccess();
  if (!guard.ok) return { ok: false, error: guard.error };
  const admin = createAdminClient();
  const { error } = await admin.from("tie_breaks").insert({
    winning_submission_id: winnerId,
    losing_submission_id: loserId,
    reason,
    decided_by: decidedBy,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

// ── admin team (owner only) ──────────────────────────────────────
function parseRole(raw: unknown): AdminRole | null {
  const value = String(raw ?? "").trim().toLowerCase();
  return (ADMIN_ROLES as string[]).includes(value) ? (value as AdminRole) : null;
}

export async function addAdminUser(
  _: unknown,
  form: FormData,
): Promise<
  | { ok: true; email: string; password: string; generated: boolean }
  | { ok: false; error: string }
> {
  const guard = await requireTeamAccess();
  if (!guard.ok) return { ok: false, error: guard.error };

  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const role = parseRole(form.get("role"));
  const typed = String(form.get("password") ?? "").trim();

  if (!name) return { ok: false, error: "Name is required." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { ok: false, error: "Enter a valid email address." };
  if (!role) return { ok: false, error: "Pick a role." };
  if (typed && typed.length < MIN_ADMIN_PASSWORD_LENGTH)
    return {
      ok: false,
      error: `Password must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`,
    };

  const generated = !typed;
  const password = typed || generateAdminPassword();

  const created = await createAdminUser({
    name,
    email,
    password,
    role,
    createdBy: sessionLabel(guard.session),
  });
  if (!created.ok) return created;

  revalidatePath("/admin");
  return { ok: true, email, password, generated };
}


/**
 * Blocks any change that would leave zero active super admins. They're the only
 * accounts that can change or remove anyone, so hitting zero freezes the roster
 * permanently — recoverable only via the shared password or raw SQL.
 */
async function wouldOrphanSuperAdmins(target: {
  id: string;
  is_protected: boolean;
}): Promise<string | null> {
  if (!target.is_protected) return null;
  if ((await countOtherActiveSuperAdmins(target.id)) > 0) return null;
  return "That's the last active super administrator — promote someone else first.";
}

export async function setAdminUserProtected(
  id: string,
  makeProtected: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  const target = await getAdminUserById(id);
  if (!target) return { ok: false, error: "That account no longer exists." };

  if (!makeProtected) {
    // Demoting yourself out of the tier is allowed, but not if you're the last
    // one holding it open.
    const orphan = await wouldOrphanSuperAdmins(target);
    if (orphan) return { ok: false, error: orphan };
  }
  if (makeProtected && target.role !== "owner")
    return {
      ok: false,
      error: "Only owners can be made super administrators. Change their role first.",
    };

  const res = await updateAdminUser(id, { is_protected: makeProtected });
  if (!res.ok) return res;
  revalidatePath("/admin");
  return { ok: true };
}

export async function setAdminUserRole(
  id: string,
  roleRaw: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  const role = parseRole(roleRaw);
  if (!role) return { ok: false, error: "Unknown role." };
  if (id === guard.session.id)
    return { ok: false, error: "You can't change your own role." };

  const target = await getAdminUserById(id);
  if (!target) return { ok: false, error: "That account no longer exists." };
  if (role !== "owner") {
    // Super admin is an owner-only tier, so demoting one drops them out of it.
    const orphan = await wouldOrphanSuperAdmins(target);
    if (orphan) return { ok: false, error: orphan };
  }
  if (
    target.role === "owner" &&
    role !== "owner" &&
    (await countOtherActiveOwners(id)) === 0
  )
    return {
      ok: false,
      error: "That's the last active owner — promote someone else first.",
    };

  const res = await updateAdminUser(id, { role });
  if (!res.ok) return res;
  revalidatePath("/admin");
  return { ok: true };
}

export async function setAdminUserActive(
  id: string,
  isActive: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };
  if (id === guard.session.id)
    return { ok: false, error: "You can't deactivate your own account." };

  if (!isActive) {
    const target = await getAdminUserById(id);
    if (target) {
      const orphan = await wouldOrphanSuperAdmins(target);
      if (orphan) return { ok: false, error: orphan };
    }
    if (target?.role === "owner" && (await countOtherActiveOwners(id)) === 0)
      return {
        ok: false,
        error: "That's the last active owner — promote someone else first.",
      };
  }

  const res = await updateAdminUser(id, { is_active: isActive });
  if (!res.ok) return res;
  revalidatePath("/admin");
  return { ok: true };
}

export async function resetAdminUserPassword(
  id: string,
  passwordRaw?: string,
): Promise<{ ok: true; password: string } | { ok: false; error: string }> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  const typed = String(passwordRaw ?? "").trim();
  if (typed && typed.length < MIN_ADMIN_PASSWORD_LENGTH)
    return {
      ok: false,
      error: `Password must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`,
    };

  const password = typed || generateAdminPassword();
  const res = await setAdminUserPassword(id, password);
  if (!res.ok) return res;
  revalidatePath("/admin");
  return { ok: true, password };
}

/**
 * Self-service password change for the signed-in admin.
 *
 * Guarded by requireAdmin, NOT requireWriteAccess: changing your own password
 * is account self-service rather than a change to event data, so read-only
 * viewers must be able to do it too.
 */
export async function changeOwnPassword(
  _: unknown,
  form: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };
  const { session } = guard;

  if (session.viaSharedPassword)
    return {
      ok: false,
      error:
        "You're signed in with the shared password, which isn't tied to an account. Sign in with your own email and password to change it.",
    };

  const current = String(form.get("currentPassword") ?? "");
  const next = String(form.get("newPassword") ?? "");
  const confirm = String(form.get("confirmPassword") ?? "");

  if (next.length < MIN_ADMIN_PASSWORD_LENGTH)
    return {
      ok: false,
      error: `New password must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`,
    };
  if (next !== confirm)
    return { ok: false, error: "The two new passwords don't match." };
  if (next === current)
    return { ok: false, error: "That's already your password — pick a different one." };

  const user = await findAdminUserById(session.id);
  if (!user)
    return {
      ok: false,
      error: "Your account no longer exists. Sign out and back in.",
    };
  // Verify the current password so a walked-up-to, unlocked laptop can't be
  // used to lock the real owner out of their own account.
  if (!(await verifyAdminPassword(current, user.password_hash)))
    return { ok: false, error: "Your current password is wrong." };

  const res = await setAdminUserPassword(session.id, next);
  if (!res.ok) return res;
  revalidatePath("/admin");
  return { ok: true };
}

export async function removeAdminUser(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };
  if (id === guard.session.id)
    return { ok: false, error: "You can't delete your own account." };

  const target = await getAdminUserById(id);
  if (target) {
    const orphan = await wouldOrphanSuperAdmins(target);
    if (orphan) return { ok: false, error: orphan };
  }
  if (target?.role === "owner" && (await countOtherActiveOwners(id)) === 0)
    return {
      ok: false,
      error: "That's the last active owner — promote someone else first.",
    };

  const res = await deleteAdminUser(id);
  if (!res.ok) return res;
  revalidatePath("/admin");
  return { ok: true };
}

// ── email campaigns ──────────────────────────────────────────────

const MAX_SUBJECT = 200;

function validateCampaign(subject: string, bodyHtml: string): string | null {
  if (!subject.trim()) return "Subject is required.";
  if (subject.length > MAX_SUBJECT)
    return `Subject must be under ${MAX_SUBJECT} characters.`;
  // Strip tags to check there's actual copy, not just empty formatting.
  if (!htmlToText(bodyHtml).trim()) return "The message body is empty.";
  return null;
}

/** Live recipient count for the composer, so you know the blast size up front. */
export async function previewAudience(
  audienceRaw: string,
): Promise<
  | { ok: true; subscribed: number; unsubscribed: number }
  | { ok: false; error: string }
> {
  const guard = await requireWriteAccess();
  if (!guard.ok) return { ok: false, error: guard.error };
  const audience = parseAudience(audienceRaw);
  if (!audience) return { ok: false, error: "Pick an audience." };
  const counts = await countAudience(audience);
  return { ok: true, ...counts };
}

/**
 * Sends the draft to one address only. Nothing is recorded as a campaign —
 * this is for checking rendering before committing to a real blast.
 */
export async function sendCampaignTest(
  _: unknown,
  form: FormData,
): Promise<{ ok: true; to: string } | { ok: false; error: string }> {
  const guard = await requireWriteAccess();
  if (!guard.ok) return { ok: false, error: guard.error };

  const to = String(form.get("testEmail") ?? "").trim().toLowerCase();
  const subject = String(form.get("subject") ?? "").trim();
  const bodyHtml = sanitizeCampaignHtml(String(form.get("bodyHtml") ?? ""));

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to))
    return { ok: false, error: "Enter a valid test address." };
  const invalid = validateCampaign(subject, bodyHtml);
  if (invalid) return { ok: false, error: invalid };
  if (!resendConfigured())
    return { ok: false, error: "RESEND_API_KEY is not configured on this environment." };

  const html = renderCampaignEmail({ bodyHtml, unsubscribeUrl: null });
  const res = await sendOne({
    to,
    subject: `[TEST] ${subject}`,
    html,
    text: htmlToText(bodyHtml),
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, to };
}

/**
 * The real blast. Writes the campaign row BEFORE sending so a crash mid-send
 * still leaves a record that something went out, rather than silently mailing
 * hundreds of people with no trace.
 */
export async function sendCampaign(
  _: unknown,
  form: FormData,
): Promise<
  | { ok: true; sent: number; failed: number; errors: string[] }
  | { ok: false; error: string }
> {
  const guard = await requireWriteAccess();
  if (!guard.ok) return { ok: false, error: guard.error };

  const subject = String(form.get("subject") ?? "").trim();
  const bodyHtml = sanitizeCampaignHtml(String(form.get("bodyHtml") ?? ""));
  const audience = parseAudience(form.get("audience"));
  const confirm = String(form.get("confirm") ?? "").trim().toUpperCase();

  if (!audience) return { ok: false, error: "Pick an audience." };
  const invalid = validateCampaign(subject, bodyHtml);
  if (invalid) return { ok: false, error: invalid };
  if (confirm !== "SEND")
    return { ok: false, error: 'Type SEND in the confirmation box to send.' };
  if (!resendConfigured())
    return { ok: false, error: "RESEND_API_KEY is not configured on this environment." };

  const loaded = await loadRecipients(audience);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  if (loaded.recipients.length === 0)
    return { ok: false, error: "No subscribed recipients in that audience." };

  const created = await createCampaign({
    subject,
    bodyHtml,
    audience,
    recipientCount: loaded.recipients.length,
    createdBy: sessionLabel(guard.session),
  });
  if (!created.ok) return { ok: false, error: created.error };

  const base = siteUrl();
  const text = htmlToText(bodyHtml);
  const messages = loaded.recipients.map((r) => {
    // Admin audiences have no registration row, so there's nothing to
    // unsubscribe from — internal operational mail ships without the footer
    // link or the List-Unsubscribe headers.
    const unsub = r.id ? unsubscribeUrl(base, r.id) : null;
    return {
      to: r.email,
      subject,
      html: renderCampaignEmail({
        bodyHtml,
        unsubscribeUrl: unsub,
        recipientName: r.full_name,
        internal: isAdminAudience(audience),
      }),
      text: unsub ? `${text}\n\n—\nUnsubscribe: ${unsub}` : text,
      unsubscribeUrl: unsub,
    };
  });

  const result = await sendBatch(messages);
  await finalizeCampaign(created.id, {
    status: result.failed === 0 ? "sent" : result.sent === 0 ? "failed" : "sent",
    sent_count: result.sent,
    failed_count: result.failed,
    error_detail: result.errors.length ? result.errors.join(" | ") : null,
  });

  revalidatePath("/admin");
  return { ok: true, sent: result.sent, failed: result.failed, errors: result.errors };
}

// ── campaign image upload ────────────────────────────────────────

const IMAGE_BUCKET = "campaign-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
// No WebP or AVIF: Outlook and several older clients render them as a broken
// image, and a blast is the wrong place to discover that.
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif"]);

export async function uploadCampaignImage(
  form: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const guard = await requireWriteAccess();
  if (!guard.ok) return { ok: false, error: guard.error };

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "Pick an image to upload." };
  if (!ALLOWED_IMAGE_TYPES.has(file.type))
    return { ok: false, error: "Use a PNG, JPEG, or GIF — other formats don't render in every email client." };
  if (file.size > MAX_IMAGE_BYTES)
    return { ok: false, error: `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. Keep it under 5 MB.` };

  const ext = file.type === "image/png" ? "png" : file.type === "image/gif" ? "gif" : "jpg";
  const key = `${Date.now()}-${randomUUID()}.${ext}`;

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(IMAGE_BUCKET)
    .upload(key, await file.arrayBuffer(), {
      contentType: file.type,
      // Emails live a long time and the URL is unique per upload, so the file
      // never changes underneath a message that already went out.
      cacheControl: "31536000",
      upsert: false,
    });

  if (error) {
    if (/bucket not found/i.test(error.message))
      return {
        ok: false,
        error: "Storage bucket missing — run supabase/migrations/0016_campaign_images.sql in the Supabase SQL Editor.",
      };
    return { ok: false, error: error.message };
  }

  const { data } = admin.storage.from(IMAGE_BUCKET).getPublicUrl(key);
  return { ok: true, url: data.publicUrl };
}
