"use server";

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
import {
  getCurrentEvent,
  setEventPhase,
  setRegistrationOpen as setRegOpen,
  setSubmissionsOpen as setSubsOpen,
} from "@/server/event";
import {
  MIN_JUDGE_PASSWORD_LENGTH,
  checkJudgeSignIn,
  deactivateJudge,
  setSharedJudgePassword as setSharedPassword,
  upsertJudge,
} from "@/server/judges";
import {
  LOCKED_OUT_MESSAGE,
  clearFailures,
  isLockedOut,
  recordFailure,
  signInKey,
} from "@/server/rate-limit";
import { deleteRegistration as removeRegistration } from "@/server/registrations";
import { computeAndLockResults, recordTieBreak as saveTieBreak } from "@/server/results";
import { saveEventSettings } from "@/server/settings";
import { setSubmissionHidden } from "@/server/submissions";
import { EMAIL_NOT_CONFIGURED } from "@/server/providers/email";
import { fileStore } from "@/server/providers/storage";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/server/uploads";
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
  emailConfigured,
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

// ── sign in / out ────────────────────────────────────────────────
export async function signInAdmin(_: unknown, form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const pw = String(form.get("password") ?? "");

  const key = signInKey("admin", email);
  if (await isLockedOut(key)) return { ok: false as const, error: LOCKED_OUT_MESSAGE };

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
        await clearFailures(key);
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
  // how the first account gets created.
  if (checkAdminPassword(pw)) {
    await clearFailures(key);
    await issueAdminCookie();
    redirect("/admin");
  }

  await recordFailure(key);
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

  try {
    const event = await getCurrentEvent();
    // The returned row is what's in the database now, so the panel can confirm
    // the change took.
    const updated = await setEventPhase(event.id, phase);
    revalidatePath("/", "layout");
    revalidatePath("/admin");
    return {
      ok: true,
      persisted: updated?.phase ?? "(unknown)",
      rowsAffected: updated ? 1 : 0,
    };
  } catch (e) {
    console.error("setPhase failed", e);
    return { ok: false, error: `Database error: ${errorMessage(e)}` };
  }
}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Runs a write and reports a failure as a message instead of throwing. */
async function attempt(
  work: () => Promise<void>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await work();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

// ── event settings ───────────────────────────────────────────────

/** Trim text and drop blank lines from lists, so a stray newline isn't an error. */
function tidy(value: unknown): unknown {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    const items = value.map(tidy);
    return items.every((v) => typeof v === "string") ? items.filter((v) => v !== "") : items;
  }
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, tidy(v)]));
  return value;
}

export async function saveSettings(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireWriteAccess();
  if (!guard.ok) return { ok: false, error: guard.error };
  try {
    const result = await saveEventSettings(await getCurrentEvent(), tidy(input));
    if (!result.ok) return { ok: false, error: result.error };
    // The event's name and lists appear on every page.
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
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

  // No password yet: they can't sign in until the shared password is set.
  const event = await getCurrentEvent();
  const res = await attempt(async () => {
    await upsertJudge(event.id, { name, email, role });
  });
  if (!res.ok) return { ok: false as const, error: res.error };
  revalidatePath("/admin");
  return { ok: true as const };
}

export async function removeJudge(
  judgeId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireWriteAccess();
  if (!guard.ok) return { ok: false, error: guard.error };
  const event = await getCurrentEvent();
  const res = await attempt(() => deactivateJudge(event.id, judgeId));
  if (res.ok) revalidatePath("/admin");
  return res;
}

// ── registrations ────────────────────────────────────────────────
export async function deleteRegistration(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireWriteAccess();
  if (!guard.ok) return { ok: false, error: guard.error };
  const event = await getCurrentEvent();
  const res = await attempt(() => removeRegistration(event.id, id));
  if (res.ok) revalidatePath("/admin");
  return res;
}

// ── registration open/close (participants + mentors) ────────────
export async function setRegistrationOpen(
  open: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireWriteAccess();
  if (!guard.ok) return { ok: false, error: guard.error };
  const event = await getCurrentEvent();
  const res = await attempt(() => setRegOpen(event.id, open));
  if (res.ok) {
    revalidatePath("/", "layout");
    revalidatePath("/admin");
  }
  return res;
}

// ── submission form open/close ──────────────────────────────────
export async function setSubmissionsOpen(
  open: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireWriteAccess();
  if (!guard.ok) return { ok: false, error: guard.error };
  const event = await getCurrentEvent();
  const res = await attempt(() => setSubsOpen(event.id, open));
  if (res.ok) {
    revalidatePath("/", "layout");
    revalidatePath("/admin");
  }
  return res;
}

// ── shared password for all judges ───────────────────────────────
export async function setSharedJudgePassword(
  _: unknown,
  form: FormData,
): Promise<{ ok: true; updated: number } | { ok: false; error: string }> {
  const guard = await requireWriteAccess();
  if (!guard.ok) return { ok: false, error: guard.error };
  const password = String(form.get("password") ?? "").trim();
  if (password.length < MIN_JUDGE_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Password must be at least ${MIN_JUDGE_PASSWORD_LENGTH} characters`,
    };
  }
  try {
    const event = await getCurrentEvent();
    const { updated } = await setSharedPassword(event.id, password);
    revalidatePath("/admin");
    return { ok: true, updated };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

// ── diagnose sign-in — pinpoints exactly why a judge can't log in ──
export async function diagnoseJudgeSignIn(
  _: unknown,
  form: FormData,
): Promise<
  | {
      ok: true;
      onRoster: boolean;
      isActive: boolean | null;
      hasPassword: boolean;
      passwordMatches: boolean;
      lockedOut: boolean;
      wouldSignIn: boolean;
    }
  | { ok: false; error: string }
> {
  const guard = await requireWriteAccess();
  if (!guard.ok) return { ok: false, error: guard.error };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { ok: false, error: "Email + password required" };

  // The same check the sign-in page runs, with each step reported.
  const event = await getCurrentEvent();
  const check = await checkJudgeSignIn(event.id, email, password);
  const lockedOut = await isLockedOut(signInKey("judge", email));
  return {
    ok: true,
    onRoster: check.onRoster,
    isActive: check.isActive,
    hasPassword: check.hasPassword,
    passwordMatches: check.passwordMatches,
    lockedOut,
    wouldSignIn: !!check.judge && !lockedOut,
  };
}

// ── one-off test account with a known password ──────────────────
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
  if (password.length < MIN_JUDGE_PASSWORD_LENGTH)
    return {
      ok: false,
      error: `Password must be at least ${MIN_JUDGE_PASSWORD_LENGTH} characters`,
    };

  const event = await getCurrentEvent();
  const res = await attempt(async () => {
    await upsertJudge(event.id, { name, email, role, password });
  });
  if (!res.ok) return res;
  revalidatePath("/admin");
  return { ok: true, email };
}

export async function toggleHideSubmission(
  id: string,
  hidden: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireWriteAccess();
  if (!guard.ok) return { ok: false, error: guard.error };
  const event = await getCurrentEvent();
  const res = await attempt(() => setSubmissionHidden(event.id, id, hidden));
  if (res.ok) revalidatePath("/admin");
  return res;
}

// ── top-6 compute + lock ─────────────────────────────────────────
export async function computeAndLockTop6(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireWriteAccess();
  if (!guard.ok) return { ok: false, error: guard.error };

  const seedInput = String(formData.get("seed") ?? "").trim();
  const seed = seedInput ? Number.parseInt(seedInput, 10) : Date.now();
  if (!Number.isSafeInteger(seed)) return { ok: false, error: "The seed must be a whole number." };

  const event = await getCurrentEvent();
  const res = await attempt(async () => {
    await computeAndLockResults(event, seed);
  });
  if (!res.ok) return res;

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
  const event = await getCurrentEvent();
  const res = await attempt(() =>
    saveTieBreak(event.id, { winnerId, loserId, reason, decidedBy }),
  );
  if (res.ok) revalidatePath("/admin");
  return res;
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
  const counts = await countAudience((await getCurrentEvent()).id, audience);
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
  if (!emailConfigured()) return { ok: false, error: EMAIL_NOT_CONFIGURED };

  const html = renderCampaignEmail({
    eventName: (await getCurrentEvent()).settings.name,
    bodyHtml,
    unsubscribeUrl: null,
  });
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
  if (!emailConfigured()) return { ok: false, error: EMAIL_NOT_CONFIGURED };

  const event = await getCurrentEvent();
  const loaded = await loadRecipients(event.id, audience);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  if (loaded.recipients.length === 0)
    return { ok: false, error: "No subscribed recipients in that audience." };

  const created = await createCampaign({
    eventId: event.id,
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
        eventName: event.settings.name,
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
  if (file.size > MAX_UPLOAD_BYTES)
    return {
      ok: false,
      error: `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. Keep it under ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
    };

  const ext = file.type === "image/png" ? "png" : file.type === "image/gif" ? "gif" : "jpg";
  try {
    const event = await getCurrentEvent();
    // Where it's kept (the database, S3, Supabase Storage) is a setting.
    return {
      ok: true,
      ...(await fileStore().put({
        eventId: event.id,
        contentType: file.type,
        bytes: Buffer.from(await file.arrayBuffer()),
        ext,
        createdBy: sessionLabel(guard.session),
      })),
    };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
