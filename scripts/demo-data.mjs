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
// Everything it writes is findable again: submissions carry review_note =
// DEMO_TAG (an admin-only column) and both accounts use @example.org
// addresses. Re-running replaces the samples and gives each account a fresh
// password (or the one passed with --judge-password / --mentor-password).
// Run --cleanup before real submissions open: sample rows count toward every
// judge's queue and the final ranking.

import { connect, currentEventId, insertRow } from "./_db.mjs";
import { die, generatePassword, hashPassword, parseArgs } from "./_password.mjs";

const DEMO_TAG = "demo-seed: sample submission";

const ACCOUNTS = [
  { key: "judge", name: "Demo Judge (Test)", email: "demo.judge@example.org", role: "judge" },
  { key: "mentor", name: "Demo Mentor (Test)", email: "demo.mentor@example.org", role: "mentor" },
];

// Every link is a placeholder on example.org.
const links = (slug) => ({
  demo_video_url: `https://example.org/samples/${slug}/demo`,
  pitch_deck_url: `https://example.org/samples/${slug}/deck.pdf`,
  summary_url: `https://example.org/samples/${slug}/summary.pdf`,
  github_url: `https://example.org/samples/${slug}/code`,
  linkedin_post_url: `https://example.org/samples/${slug}/announcement`,
});

const OWN = "Own problem (not one of the briefs)";

// Keep track, brief and option values in step with src/lib/hackathon.ts and
// the lists in src/app/submit/submit-form.tsx.
const SAMPLES = [
  {
    project_name: "ShiftBoard (Sample)",
    team_name: "Tuesday Crew",
    solo_or_team: "Team",
    team_size: 3,
    challenge_track: "Web & Mobile Apps",
    problem_brief: "1 · Help a small nonprofit schedule its volunteers",
    project_category: "Volunteer scheduling",
    customer_type: "Organizations",
    region: "North America",
    country: "Canada",
    focus_area: "Civic & Community",
    impact_focus: "Saves time, Builds community",
    solution_stage: "Prototype",
    area_of_specification: "Design & Usability",
    applies_ai: "No",
    target_region: "Food banks and community kitchens",
    core_problem: "Volunteer shifts go unfilled because nobody can see the gaps",
    problem_statement:
      "A neighbourhood food bank coordinates about forty volunteers through a group chat. Messages scroll past, people assume someone else has taken a shift, and the organizer only finds out a shift is empty when nobody turns up.",
    project_description_summary:
      "A shared shift board that texts the organizer each morning with the shifts still empty.",
    project_description:
      "ShiftBoard is a single page listing the week's shifts. Volunteers tap a shift to take it, with no account needed: they confirm by text message.\n\nEach morning the organizer gets one text listing only the shifts that are still empty, with a link to nudge people who covered that shift before.",
    disclosure_statement:
      "Before the event: nothing. Built during the event: the shift board, the text confirmation flow and the morning summary. We tested it with six volunteers from one food bank.",
    technologies_used: "Next.js, Postgres, an SMS gateway",
    member1_name: "Maya Example",
    member2_name: "Tom Example",
    member3_name: "Priya Example",
    live_demo_url: "https://example.org/samples/shiftboard/live",
  },
  {
    project_name: "NextBus Voice (Sample)",
    team_name: "Stop Request",
    solo_or_team: "Team",
    team_size: 2,
    challenge_track: "AI & Data",
    problem_brief: "2 · Make local transit times easier to check",
    project_category: "Voice transit times",
    customer_type: "Individuals",
    region: "Europe",
    country: "Ireland",
    focus_area: "Accessibility",
    impact_focus: "Improves access, Saves time",
    solution_stage: "Prototype",
    area_of_specification: "Technology",
    applies_ai: "Yes",
    target_region: "Cities that publish open transit feeds",
    core_problem: "Transit apps assume the rider can read a small, busy screen",
    problem_statement:
      "Riders with low vision, and anyone with their hands full, struggle with transit apps built around maps and long lists. What they want is one fact: when the next bus leaves from the stop they're standing at.",
    project_description_summary:
      "Ask out loud when the next bus leaves and hear one short answer.",
    project_description:
      "NextBus Voice works out the nearest stop from the phone's location and reads the next two departures aloud from the city's open transit feed.\n\nThere is no screen to navigate. A single large button repeats the answer. Speech recognition is used only to let the rider name a different stop.",
    disclosure_statement:
      "Before the event: nothing. Built during the event: the feed reader, the nearest-stop lookup and the voice interface. Speech recognition and speech output use the phone's built-in services.",
    technologies_used: "TypeScript, open transit feeds, on-device speech",
    member1_name: "Aoife Example",
    member2_name: "Daniel Example",
  },
  {
    project_name: "RoomSense (Sample)",
    team_name: "Solder & Co",
    solo_or_team: "Team",
    team_size: 4,
    challenge_track: "Hardware & Devices",
    problem_brief: OWN,
    project_category: "Classroom air quality monitor",
    customer_type: "Organizations",
    region: "Asia",
    country: "India",
    focus_area: "Health & Wellbeing",
    impact_focus: "Improves safety",
    solution_stage: "Prototype",
    area_of_specification: "Technology",
    applies_ai: "No",
    target_region: "Schools without building management systems",
    core_problem: "Nobody in a stuffy classroom knows when to open a window",
    problem_statement:
      "Carbon dioxide builds up quickly in a full classroom and makes it harder to concentrate, but there is no sign of it until people feel tired. Commercial monitors cost more than most schools will pay per room.",
    project_description_summary:
      "A $25 box with one light that turns amber when the room needs fresh air.",
    project_description:
      "RoomSense is a small sensor board in a printed case with a single light: green, amber or red. It needs no network and no app.\n\nA teacher sees amber and opens a window. An optional memory card logs readings so a school can compare rooms over a term.",
    disclosure_statement:
      "Before the event: one team member owned the sensor. Built during the event: the firmware, the case design, the logging and a parts list priced from two suppliers.",
    technologies_used: "Microcontroller, CO2 sensor, 3D-printed case, C++",
    member1_name: "Arjun Example",
    member2_name: "Sara Example",
    member3_name: "Kenji Example",
    member4_name: "Lucia Example",
  },
  {
    project_name: "Repro (Sample)",
    team_name: "Works On My Machine",
    solo_or_team: "Solo",
    team_size: 1,
    challenge_track: "Developer Tools",
    problem_brief: "4 · Cut the time it takes to report a bug well",
    project_category: "Bug report recorder",
    customer_type: "Organizations",
    region: "South America",
    country: "Brazil",
    focus_area: "Developer Experience",
    impact_focus: "Saves time",
    solution_stage: "MVP / Pilot",
    area_of_specification: "Technology",
    applies_ai: "No",
    target_region: "Small web teams",
    core_problem: "Bug reports arrive without the steps needed to reproduce them",
    problem_statement:
      "A tester writes \"checkout is broken\" and a developer spends an hour finding out how. The details that matter, such as what was clicked, what the page requested and what failed, are gone by the time anyone asks.",
    project_description_summary:
      "A browser extension that turns the last sixty seconds into a ready-to-file bug report.",
    project_description:
      "Repro keeps a rolling record of clicks, page changes and failed requests in the browser. When something breaks, one button produces a report with numbered steps and the failing request.\n\nNothing leaves the browser until the tester presses the button, and form values are left out of the record.",
    disclosure_statement:
      "Before the event: nothing. Built during the event: the extension, the recorder and the report format. Tried on two open source web apps.",
    technologies_used: "TypeScript, browser extension APIs",
    member1_name: "Rafael Example",
    live_demo_url: "https://example.org/samples/repro/live",
  },
  {
    project_name: "Pocket Tutor (Sample)",
    team_name: "Offline First",
    solo_or_team: "Team",
    team_size: 3,
    challenge_track: "Social Good",
    problem_brief: "3 · A study tool that still works offline",
    project_category: "Offline revision cards",
    customer_type: "Individuals",
    region: "Africa",
    country: "Kenya",
    focus_area: "Education",
    impact_focus: "Improves access, Saves money",
    solution_stage: "Prototype",
    area_of_specification: "Design & Usability",
    applies_ai: "No",
    target_region: "Students with shared or occasional internet access",
    core_problem: "Revision apps stop working the moment the connection drops",
    problem_statement:
      "Many students share a phone or have data for only part of the week. Most study apps load their content from a server every time, so a lost connection means a lost evening of revision.",
    project_description_summary:
      "Revision cards that download once and work for the rest of the term without a connection.",
    project_description:
      "Pocket Tutor packs a term of revision cards into one small download. After that it runs entirely on the phone and schedules cards so the ones a student gets wrong come back sooner.\n\nTeachers write card sets in a spreadsheet and share them as a single file, which can be passed from phone to phone.",
    disclosure_statement:
      "Before the event: the spaced-repetition schedule is a published method. Built during the event: the app, the card format and a sample set of forty cards.",
    technologies_used: "Progressive web app, local storage, TypeScript",
    member1_name: "Wanjiru Example",
    member2_name: "Samuel Example",
    member3_name: "Grace Example",
  },
];

// The one pre-filled score, so the dashboard shows a "Scored" row and the
// submission page shows Update Score. Totals 70 out of 100.
const SAMPLE_SCORE = {
  project_name: "ShiftBoard (Sample)",
  impact: 4,
  impact_evidence:
    "Impact (4): tested with six volunteers at one food bank; unfilled shifts fell from nine a week to two.",
  innovation: 3,
  innovation_evidence:
    "Innovation (3): shift boards exist; confirming by text with no account is the new part.",
  sustainability: 4,
  sustainability_evidence:
    "Sustainability (4): text messages are the only running cost and the organizer can maintain it alone.",
  feasibility: 3,
  feasibility_evidence:
    "Feasibility (3): the demo ran end to end, but the reminder texts were sent by hand.",
  scalability: 3,
  scalability_evidence:
    "Scalability (3): could serve other food banks, but each one needs manual setup.",
};

const args = parseArgs(process.argv.slice(2));
const cleanup = args.cleanup === true;

const pool = connect();
const eventId = await currentEventId(pool);

async function removeSamples() {
  // Scores and recusals on these rows go with them (on delete cascade).
  const { rowCount } = await pool.query(
    "delete from submissions where event_id = $1 and review_note = $2",
    [eventId, DEMO_TAG],
  );
  return rowCount ?? 0;
}

if (cleanup) {
  console.log(`✓ Removed ${await removeSamples()} sample submission(s)`);
  for (const a of ACCOUNTS) {
    const { rowCount } = await pool.query(
      "delete from judges where event_id = $1 and lower(email) = $2",
      [eventId, a.email],
    );
    console.log(rowCount ? `✓ Removed ${a.email}` : `· ${a.email} wasn't there`);
  }
  await pool.end();
  process.exit(0);
}

// ── accounts ─────────────────────────────────────────────────────
const created = [];
for (const a of ACCOUNTS) {
  const password = String(args[`${a.key}-password`] ?? "") || generatePassword();
  if (password.length < 8) die(`--${a.key}-password must be at least 8 characters`);
  const { rows } = await pool.query(
    `insert into judges (event_id, name, email, role, is_active, password_hash)
     values ($1, $2, $3, $4, true, $5)
     on conflict (event_id, lower(email))
     do update set name = excluded.name, role = excluded.role, is_active = true,
                   password_hash = excluded.password_hash
     returning id`,
    [eventId, a.name, a.email, a.role, await hashPassword(password)],
  );
  created.push({ ...a, password, judgeId: rows[0].id });
}

// ── submissions ──────────────────────────────────────────────────
await removeSamples();
const inserted = [];
for (const [i, s] of SAMPLES.entries()) {
  const slug = s.project_name.replace(/ \(Sample\)$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  try {
    const row = await insertRow(
      pool,
      "submissions",
      {
        ...links(slug),
        ...s,
        event_id: eventId,
        member1_email: `sample.team${i + 1}@example.org`,
        mentor_name: "Demo Mentor (Test)",
        is_submission_complete: true,
        needs_review: false,
        hidden_from_judges: false,
        review_note: DEMO_TAG,
      },
      "id, project_name",
    );
    inserted.push(row);
  } catch (e) {
    if (e.code === "23505")
      die(`"${s.project_name}" already exists and isn't a sample — rename or remove it first`);
    throw e;
  }
}
console.log(`✓ Seeded ${inserted.length} sample submissions`);

// ── one pre-filled score ─────────────────────────────────────────
const judge = created.find((c) => c.key === "judge");
const target = inserted.find((s) => s.project_name === SAMPLE_SCORE.project_name);
const { project_name: _name, ...scoreValues } = SAMPLE_SCORE;
await insertRow(pool, "scores", {
  event_id: eventId,
  judge_id: judge.judgeId,
  submission_id: target.id,
  ...scoreValues,
});
console.log(`✓ Scored "${SAMPLE_SCORE.project_name}" as ${judge.name}`);

if (args["keep-phase"] !== true) {
  await pool.query("update events set phase = 'judging', updated_at = now() where id = $1", [eventId]);
  console.log("✓ Event moved to the judging phase");
}

await pool.end();

console.log("\nSign in at /judge (passwords shown once):");
for (const c of created) console.log(`  ${c.role.padEnd(6)}  ${c.email}  ${c.password}`);
console.log("\nRemove it all with: npm run db:seed -- --cleanup");
