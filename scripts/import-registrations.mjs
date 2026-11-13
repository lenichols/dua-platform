#!/usr/bin/env node
// Bulk-import registrations from a ticketing export (.xlsx or .csv).
//
//   node --env-file=.env.local scripts/import-registrations.mjs \
//     path/to/export.xlsx [--role participant] [--commit]
//
// Dry run by default — it prints exactly what it would insert and exits
// without touching the database. Add --commit to write.
//
// Safe to re-run on an updated export: rows whose email already exists for
// that role are skipped, never updated, so a later export missing a column
// (Eventbrite drops Home Country once the ticket type stops asking for it)
// can't blank out detail an earlier import captured.

import { createClient } from "@supabase/supabase-js";
import { readSheet } from "./_spreadsheet.mjs";
import { die, parseArgs } from "./_password.mjs";

const argv = process.argv.slice(2);
const args = parseArgs(argv);
// parseArgs only reads --flags; the file is the first bare argument.
const file = String(args.file ?? argv.find((a) => !a.startsWith("--")) ?? "");
if (!file) die("pass the export file: scripts/import-registrations.mjs <file.xlsx>");

const role = String(args.role ?? "participant").trim().toLowerCase();
if (!["participant", "mentor"].includes(role))
  die("--role must be participant or mentor");

const heardAbout = args["heard-about"] === undefined ? "Eventbrite" : String(args["heard-about"]);
const commit = args.commit === true || args.commit === "true";

// ── column mapping ───────────────────────────────────────────────
// Header text varies between exports; match on any of these, lower-cased.
const COLUMNS = {
  full_name: ["full name", "name", "attendee name"],
  first_name: ["first name", "firstname"],
  last_name: ["last name", "lastname", "surname"],
  email: ["email", "email address", "attendee email"],
  country: ["home country", "country"],
  phone: ["phone", "cell phone", "phone number", "mobile"],
  organization: ["company", "organization", "organisation", "employer"],
  created_at: ["order date", "date", "registration date", "created"],
  status: ["attendee status", "status", "order status"],
};

function pick(row, field) {
  for (const header of COLUMNS[field]) {
    const v = row[header];
    if (v !== undefined && v !== "") return v;
  }
  return "";
}

// ── normalisation ────────────────────────────────────────────────
/**
 * Title-case a name that arrived SHOUTING or all lowercase. A name that
 * already mixes case is left exactly as the person typed it — that's the only
 * evidence we have of how they capitalise their own name (McDonald, de Souza).
 */
function normalizeName(name) {
  const clean = name.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (clean !== clean.toUpperCase() && clean !== clean.toLowerCase()) return clean;
  return clean.replace(
    /[^\s]+/g,
    (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
  );
}

/** Excel stores dates as days since 1899-12-30; CSV exports write real text. */
function normalizeDate(raw) {
  const v = String(raw).trim();
  if (!v) return null;
  if (/^\d+(\.\d+)?$/.test(v)) {
    const ms = Math.round((Number(v) - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// Ticketing exports use a literal placeholder when the buyer never filled in
// the attendee's details. There's no person here to import.
const PLACEHOLDER = /^(info requested|not provided|n\/?a|unknown|-+)$/i;

// ── read ─────────────────────────────────────────────────────────
let sheet;
try {
  sheet = readSheet(file);
} catch (e) {
  die(`could not read ${file}: ${e.message}`);
}
const { headers, rows } = sheet;
if (!rows.length) die(`${file} has no data rows`);

const skipped = { placeholder: [], invalid_email: [], not_attending: [], duplicate_in_file: [] };
const byEmail = new Map();

for (const [i, row] of rows.entries()) {
  const line = i + 2; // 1-based, plus the header row
  const email = pick(row, "email").trim();
  const first = pick(row, "first_name");
  const last = pick(row, "last_name");
  const full = pick(row, "full_name") || `${first} ${last}`.trim();

  const status = pick(row, "status").trim();
  if (status && !/^(attending|completed|checked in|valid)$/i.test(status)) {
    skipped.not_attending.push(`line ${line}: ${email || full || "(blank)"} — ${status}`);
    continue;
  }
  if (PLACEHOLDER.test(email) || PLACEHOLDER.test(full)) {
    skipped.placeholder.push(`line ${line}: ${full || "(blank)"}`);
    continue;
  }
  if (!EMAIL_RE.test(email)) {
    skipped.invalid_email.push(`line ${line}: ${full || "(blank)"} — ${email || "(blank)"}`);
    continue;
  }

  const name = normalizeName(full);
  if (!name) {
    skipped.invalid_email.push(`line ${line}: ${email} — no name`);
    continue;
  }

  const record = {
    full_name: name,
    email,
    role,
    country: pick(row, "country").trim() || null,
    phone: pick(row, "phone").trim() || null,
    organization: pick(row, "organization").trim() || null,
    heard_about: heardAbout || null,
    created_at: normalizeDate(pick(row, "created_at")),
  };
  if (!record.created_at) delete record.created_at; // fall back to the column default

  const key = email.toLowerCase();
  const seen = byEmail.get(key);
  if (seen) {
    // Same person, several tickets. Keep the earliest — that's when they
    // actually signed up — but let a later row fill in a blank field.
    skipped.duplicate_in_file.push(`line ${line}: ${email}`);
    for (const [k, v] of Object.entries(record)) {
      if (k !== "created_at" && v && !seen[k]) seen[k] = v;
    }
    if (record.created_at && seen.created_at && record.created_at < seen.created_at)
      seen.created_at = record.created_at;
    continue;
  }
  byEmail.set(key, record);
}

// ── compare against the database ─────────────────────────────────
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  die("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY — pass --env-file=.env.local");

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const existing = new Set();
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase
    .from("registrations")
    .select("email")
    .eq("role", role)
    .range(from, from + 999);
  if (error) die(error.message);
  for (const r of data) existing.add(String(r.email).trim().toLowerCase());
  if (data.length < 1000) break;
}

const toInsert = [];
const alreadyPresent = [];
for (const [email, record] of byEmail) {
  if (existing.has(email)) alreadyPresent.push(record.email);
  else toInsert.push(record);
}

// ── report ───────────────────────────────────────────────────────
console.log(`\nFile      ${file}`);
console.log(`Columns   ${headers.filter(Boolean).join(", ")}`);
console.log(`Role      ${role}${heardAbout ? `   heard_about: ${heardAbout}` : ""}\n`);
console.log(`  ${String(rows.length).padStart(4)}  rows in file`);
for (const [label, list] of [
  ["placeholder rows (no attendee details)", skipped.placeholder],
  ["invalid or missing email", skipped.invalid_email],
  ["not attending / cancelled", skipped.not_attending],
  ["duplicate email within the file", skipped.duplicate_in_file],
])
  if (list.length) console.log(`  ${String(-list.length).padStart(4)}  ${label}`);
console.log(`  ${String(-alreadyPresent.length).padStart(4)}  already registered`);
console.log(`  ${"".padStart(4, "─")}`);
console.log(`  ${String(toInsert.length).padStart(4)}  to insert\n`);

if (args.verbose === true || args.verbose === "true") {
  for (const [label, list] of Object.entries(skipped))
    if (list.length) console.log(`${label}:\n  ${list.join("\n  ")}\n`);
  if (alreadyPresent.length)
    console.log(`already registered:\n  ${alreadyPresent.join("\n  ")}\n`);
}

for (const r of toInsert)
  console.log(`  + ${r.full_name.padEnd(28)} ${r.email.padEnd(38)} ${r.created_at?.slice(0, 10) ?? ""}`);

if (!toInsert.length) {
  console.log("\nNothing to import.");
  process.exit(0);
}

if (!commit) {
  console.log(`\nDry run — nothing was written. Re-run with --commit to insert ${toInsert.length}.`);
  process.exit(0);
}

// ── insert ───────────────────────────────────────────────────────
let inserted = 0;
for (let i = 0; i < toInsert.length; i += 100) {
  const chunk = toInsert.slice(i, i + 100);
  const { data, error } = await supabase.from("registrations").insert(chunk).select("id");
  if (error) die(`insert failed after ${inserted} rows: ${error.message}`);
  inserted += data.length;
}
console.log(`\n✓ Inserted ${inserted} ${role} registration${inserted === 1 ? "" : "s"}.`);
