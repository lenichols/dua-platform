#!/usr/bin/env node
// Create or update an /admin account from the command line.
//
//   node --env-file=.env.local scripts/create-admin.mjs \
//     --email you@example.com --name "Your Name" --role owner [--password secret]
//
// Omit --password to generate one (printed once). Re-running with an existing
// email updates that account's name/role instead of creating a duplicate —
// and leaves their password alone unless you pass --password.
//
// The hash format MUST stay in sync with src/lib/admin-password.ts.

import { createClient } from "@supabase/supabase-js";
import {
  MIN_PASSWORD_LENGTH,
  ROLES,
  die,
  generatePassword,
  hashPassword,
  parseArgs,
} from "./_password.mjs";

const args = parseArgs(process.argv.slice(2));
const email = String(args.email ?? "").trim().toLowerCase();
const name = String(args.name ?? "").trim();
// Only applied when explicitly passed — an existing account keeps its current
// role otherwise, so a name edit can't silently demote someone.
const roleGiven = typeof args.role === "string" && args.role.trim() !== "";
const role = roleGiven ? args.role.trim().toLowerCase() : "viewer";

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) die("--email must be a valid address");
if (!name) die("--name is required");
if (!ROLES.includes(role)) die(`--role must be one of: ${ROLES.join(", ")}`);

// --password admin-password reuses the shared ADMIN_PASSWORD from the env file.
const requested =
  args.password === "admin-password"
    ? String(process.env.ADMIN_PASSWORD ?? "")
    : String(args.password ?? "");
if (args.password === "admin-password" && !requested)
  die("ADMIN_PASSWORD is not set in the env file");
// The /admin UI enforces MIN_PASSWORD_LENGTH with no exceptions; --allow-weak
// is a deliberate, explicit override for CLI provisioning only.
const allowWeak = args["allow-weak"] === true || args["allow-weak"] === "true";
if (requested && requested.length < MIN_PASSWORD_LENGTH && !allowWeak)
  die(
    `password must be at least ${MIN_PASSWORD_LENGTH} characters (pass --allow-weak to override)`,
  );

// --rotate generates a fresh password and applies it to an EXISTING account.
// Without it, updates leave the password alone, so a name or role edit can't
// silently lock someone out.
const rotate = args.rotate === true || args.rotate === "true";
if (rotate && requested)
  die("pass either --rotate or --password, not both");

const generated = !requested;
const password = requested || generatePassword();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  die("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY — pass --env-file=.env.local");

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const password_hash = await hashPassword(password);

const { data: existing, error: lookupError } = await supabase
  .from("admin_users")
  .select("id, role")
  .eq("email", email)
  .maybeSingle();

if (lookupError) {
  if (lookupError.code === "42P01" || lookupError.code === "PGRST205")
    die("admin_users table not found — run supabase/migrations/0012_admin_users.sql first");
  die(lookupError.message);
}

if (existing) {
  // Only touch the password if one was explicitly supplied — otherwise this
  // is a name/role edit and their current password must keep working.
  const patch = { name, is_active: true };
  if (roleGiven) patch.role = role;
  if (requested || rotate) patch.password_hash = password_hash;
  const { error } = await supabase
    .from("admin_users")
    .update(patch)
    .eq("id", existing.id);
  if (error) die(error.message);
  console.log(
    roleGiven
      ? `✓ Updated ${email} (${existing.role} → ${role})`
      : `✓ Updated ${email} (role unchanged: ${existing.role})`,
  );
  console.log(
    requested
      ? "\n  Password: the one you passed in.\n"
      : rotate
        ? `\n  New password (shown once): ${password}\n`
        : "\n  Password: unchanged.\n",
  );
  console.log("Sign in at /admin with that email + password.");
  process.exit(0);
} else {
  const { error } = await supabase.from("admin_users").insert({
    name,
    email,
    role,
    password_hash,
    is_active: true,
    created_by: "scripts/create-admin.mjs",
  });
  if (error) die(error.message);
  console.log(`✓ Created ${email} as ${role}`);
}

console.log(
  generated
    ? `\n  Password (shown once): ${password}\n`
    : `\n  Password: the one you passed in.\n`,
);
console.log("Sign in at /admin with that email + password.");
