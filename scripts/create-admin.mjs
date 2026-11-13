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

import { connect } from "./_db.mjs";
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

const pool = connect();
const password_hash = await hashPassword(password);

const { rows } = await pool.query(
  "select id, role from admin_users where lower(email) = $1",
  [email],
);
const existing = rows[0];

if (existing) {
  // Only touch the password if one was explicitly supplied — otherwise this
  // is a name/role edit and their current password must keep working.
  await pool.query(
    `update admin_users
        set name = $2,
            is_active = true,
            role = coalesce($3, role),
            password_hash = coalesce($4, password_hash),
            updated_at = now()
      where id = $1`,
    [existing.id, name, roleGiven ? role : null, requested || rotate ? password_hash : null],
  );
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
} else {
  await pool.query(
    `insert into admin_users (name, email, role, password_hash, is_active, created_by)
     values ($1, $2, $3, $4, true, 'scripts/create-admin.mjs')`,
    [name, email, role, password_hash],
  );
  console.log(`✓ Created ${email} as ${role}`);
  console.log(
    generated
      ? `\n  Password (shown once): ${password}\n`
      : `\n  Password: the one you passed in.\n`,
  );
}

await pool.end();
console.log("Sign in at /admin with that email + password.");
