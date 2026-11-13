#!/usr/bin/env node
// Seed (or remove) sample data so you can try judging without real entries.
//
//   npm run db:seed                 # add the samples
//   npm run db:seed -- --cleanup    # remove them again
//
// Seeding creates:
//   - a test judge and a test mentor (sign in at /judge)
//   - five sample submissions, one per track
//   - one score from the test judge, so the dashboard shows both states
//   - the event moved to the judging phase, so the judge can sign in
//     (pass --keep-phase to leave the phase alone)
//
// With DEMO_MODE=true in your settings, the sample accounts get fixed
// passwords, a sample admin is added, and the sign-in pages show all three.
// That is for trying Dua out or running a public demo, never a real event.
//
// Everything it writes is findable again: submissions carry review_note =
// DEMO_TAG (an admin-only column) and both accounts use @example.org
// addresses. Re-running replaces the samples and gives each account a fresh
// password (or the one passed with --judge-password / --mentor-password).
// Run --cleanup before real submissions open: sample rows count toward every
// judge's queue and the final ranking.

import { connect, currentEventId } from "./_db.mjs";
import { cleanupDemo, seedDemo } from "./_demo-seed.mjs";
import { die, parseArgs } from "./_password.mjs";

const DEMO_MODE = process.env.DEMO_MODE?.trim().toLowerCase() === "true";
const args = parseArgs(process.argv.slice(2));

const pool = connect();
const eventId = await currentEventId(pool);

if (args.cleanup === true) {
  const removed = await cleanupDemo(pool, eventId);
  console.log(`✓ Removed ${removed.submissions} sample submission(s)`);
  for (const email of removed.accounts) console.log(`✓ Removed ${email}`);
  await pool.end();
  process.exit(0);
}

const passwords = {
  judge: typeof args["judge-password"] === "string" ? args["judge-password"] : undefined,
  mentor: typeof args["mentor-password"] === "string" ? args["mentor-password"] : undefined,
};
for (const [who, value] of Object.entries(passwords)) {
  if (value !== undefined && value.length < 8) die(`--${who}-password must be at least 8 characters`);
}

let result;
try {
  result = await seedDemo(pool, eventId, {
    demoMode: DEMO_MODE,
    adminRole: process.env.DEMO_ADMIN_ROLE,
    passwords,
    keepPhase: args["keep-phase"] === true,
  });
} catch (e) {
  await pool.end();
  die(e.message);
}
await pool.end();

console.log(`✓ Seeded ${result.submissions} sample submissions`);
console.log(
  result.scored
    ? "✓ Added one sample score from the sample judge"
    : "· Skipped the sample score: this event has its own rubric",
);
if (args["keep-phase"] !== true) console.log("✓ Event moved to the judging phase");

console.log(
  DEMO_MODE
    ? "\nDemo mode is on: these logins are fixed and shown on the sign-in pages (/judge and /admin)."
    : "\nSign in at /judge (passwords shown once):",
);
for (const c of result.created) console.log(`  ${c.role.padEnd(6)}  ${c.email}  ${c.password}`);
console.log("\nRemove it all with: npm run db:seed -- --cleanup");
