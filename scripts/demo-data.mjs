#!/usr/bin/env node
// Seed (or remove) demo data for recording the judge & mentor walkthrough.
//
//   node --env-file=.env.local scripts/demo-data.mjs            # seed
//   node --env-file=.env.local scripts/demo-data.mjs --cleanup  # remove it all
//
// Seeding creates:
//   - a test judge and a test mentor (email + password sign-in at /judge)
//   - six sample submissions, one per track plus a second Track 5 entry, with
//     real public YouTube videos as the demo links and placeholder deck,
//     summary and build links
//   - one score from the test judge on the current rubric (0020), so the
//     dashboard shows both states
//
// Everything it writes is findable again: submissions carry review_note =
// DEMO_TAG (an admin-only column) and both accounts use @example.com
// addresses. Re-running --seed replaces the sample submissions and gives each
// account a fresh password (or the one passed with --judge-password /
// --mentor-password). Run --cleanup before real submissions open — sample
// rows count toward every judge's queue and the top-6 maths.
//
// Uses the same steps as Admin → Judges → Test account (createTestJudge in
// src/app/admin/actions.ts). Note that Admin → Judges → Shared sign-in
// password also resets these two accounts, like every other active judge.

import { createClient } from "@supabase/supabase-js";
import { die, generatePassword, parseArgs } from "./_password.mjs";

const DEMO_TAG = "demo-seed: judge walkthrough sample";

const ACCOUNTS = [
  { key: "judge", name: "Demo Judge (Test)", email: "demo.judge@example.com", role: "judge" },
  { key: "mentor", name: "Demo Mentor (Test)", email: "demo.mentor@example.com", role: "mentor" },
];

const yt = (id) => `https://www.youtube.com/watch?v=${id}`;

// Demo videos are real public videos about each theme, standing in for a
// team's pitch. Deck, summary, build, live-demo and announcement links are
// placeholders.
const drive = (slug) => ({
  pitch_deck_url: `https://drive.google.com/file/d/dua-sample-${slug}-deck`,
  summary_url: `https://drive.google.com/file/d/dua-sample-${slug}-summary`,
});
const SAMPLES = [
  {
    project_name: "SunCold Hub (Sample)",
    team_name: "Owerri Cold Crew",
    solo_or_team: "Team",
    team_size: 3,
    challenge_track: "New Technologies & Hardware Innovations",
    project_category: "Solar cold storage",
    customer_type: "Non-residential",
    region: "Africa",
    country: "Nigeria",
    energy_sector: "Solar",
    impact_focus: "Energy Access, Affordability",
    solution_stage: "Prototype",
    area_of_specification: "Technology",
    applies_ai: "No",
    target_region: "Produce and fish markets in southeast Nigeria",
    core_energy_problem:
      "Traders lose perishable stock within days because markets have no reliable power for refrigeration",
    problem_statement:
      "Smallholder farmers and fish traders in Imo State lose up to 40% of what they bring to market because nothing stays cold. Diesel-powered cold rooms cost more to run than the traders earn per crate, and the grid is off for most of the day.",
    project_description_summary:
      "A walk-in solar cold room that traders rent by the crate per day, booked and paid for from any phone.",
    project_description:
      "SunCold Hub is a 10 m³ walk-in cold room powered by 3 kWp of rooftop solar and a LiFePO4 battery bank, with a DC inverter compressor that holds 4–8 °C through the night.\n\nTraders rent space by the crate per day (target ₦150 per crate), booking and paying by USSD so a feature phone is enough. A temperature logger sends alerts to the market's hub attendant.\n\nDuring the sprint we built: the load and sizing calculation, a bill of materials with unit cost (~US$9,800 per hub installed), the USSD booking flow mock-up, and an 18-month plan for three pilot hubs run by a market cooperative, which also employs and trains the attendant who handles maintenance.",
    disclosure_statement:
      "Before the event: a load-sizing spreadsheet template from an earlier solar project. Built during the sprint: this hub's sizing, the bill of materials, the USSD booking mock-up and the 18-month pilot plan. Tools: Africa's Talking USSD sandbox; ChatGPT to draft the trader survey questions.",
    technologies_used:
      "3 kWp PV, LiFePO4 storage, DC inverter compressor, IoT temperature logger, USSD (Africa's Talking sandbox)",
    member1_name: "Chiamaka Eze",
    member2_name: "Tunde Bakare",
    member3_name: "Ifeoma Nwosu",
    mentor_name: "Demo Mentor (Test)",
    ...drive("suncold-hub"),
    demo_video_url: yt("VnIV65l0K0c"),
    demo_video_short_url: yt("SOJelbXta_A"),
    github_url: "https://github.com/dua-sample/suncold-hub",
    live_demo_url: null,
    linkedin_post_url: "https://www.linkedin.com/posts/dua-sample-suncold-hub",
  },
  {
    project_name: "GridSense (Sample)",
    team_name: "Lakeside Labs",
    solo_or_team: "Team",
    team_size: 4,
    challenge_track: "Digital Solutions, Apps & AI/ML Tools",
    project_category: "AI demand forecasting for mini-grids",
    customer_type: "Non-residential",
    region: "Africa",
    country: "Kenya",
    energy_sector: "Grid, Transmission & Distribution",
    impact_focus: "Availability, Affordability",
    solution_stage: "MVP / Pilot",
    area_of_specification: "Technology",
    applies_ai: "Yes",
    target_region: "Solar mini-grid operators in East Africa",
    core_energy_problem:
      "Mini-grid operators oversize diesel backup because they can't predict evening demand",
    problem_statement:
      "Rural mini-grids run diesel backup every evening because operators can't forecast demand, which pushes tariffs up for the households they serve. Customers report outages by walking to the operator's office.",
    project_description_summary:
      "Demand forecasting plus feature-phone outage reporting that helps mini-grid operators cut diesel runtime.",
    project_description:
      "GridSense forecasts next-day load for a solar mini-grid from smart-meter history and weather, and tells the operator when the battery will run short so they can shift productive-use loads instead of starting the generator.\n\nCustomers report outages by USSD (*384*22#) from any phone; reports cluster on a map for the field technician.\n\nWe claim GridSense can cut diesel runtime by 30% across an operator's 40 sites. During the sprint we trained the model on six months of anonymized meter data from one site and built the operator dashboard; the USSD flow is a clickable mock-up.",
    disclosure_statement:
      "Before the event: nothing; the team met at kickoff. Built during the sprint: the forecasting model, the operator dashboard and the USSD mock-up. Open source: LightGBM, FastAPI, Next.js. Data: six months of anonymized smart-meter readings from one partner mini-grid, shared under a data agreement, plus an open weather API. AI tools: GitHub Copilot.",
    technologies_used: "Python, LightGBM, FastAPI, Next.js, USSD gateway sandbox, open weather API",
    member1_name: "Wanjiru Kamau",
    member2_name: "Otieno Odhiambo",
    member3_name: "Aisha Mohamed",
    member4_name: "Brian Kiprop",
    mentor_name: "Demo Mentor (Test)",
    ...drive("gridsense"),
    demo_video_url: yt("emygVKnVjwA"),
    demo_video_short_url: null,
    github_url: "https://github.com/dua-sample/gridsense",
    live_demo_url: "https://example.com/gridsense-demo",
    linkedin_post_url: "https://www.linkedin.com/posts/dua-sample-gridsense",
  },
  {
    project_name: "PayDay Power (Sample)",
    team_name: "Harvest Pay",
    solo_or_team: "Team",
    team_size: 3,
    challenge_track: "Business Models & Financing Approaches",
    project_category: "Pay-as-you-go solar financing",
    customer_type: "Residential",
    region: "Africa",
    country: "Kenya",
    energy_sector: "Energy Access / Off-Grid",
    impact_focus: "Energy Access, Affordability",
    solution_stage: "Idea / Concept",
    area_of_specification: "Affordability",
    applies_ai: "No",
    target_region: "Smallholder farming households in western Kenya",
    core_energy_problem:
      "Daily pay-as-you-go plans don't match farmers who earn most of their income at harvest",
    problem_statement:
      "Pay-as-you-go solar assumes steady daily income. Farming households earn most of their money twice a year, fall behind in the lean months, and get locked out, so defaults rise and families go back to kerosene.",
    project_description_summary:
      "Harvest-aligned payment schedules for solar home systems, collected through farmer savings groups.",
    project_description:
      "PayDay Power lets a household pay less in the lean season and more after harvest, with the schedule set from the crop calendar. Payments are collected by the farmer's SACCO (savings and credit co-operative) through mobile money, and the SACCO guarantees part of the loan.\n\nUnit economics from our tariff model: a US$180 solar home system, 10% deposit, 24-month term, 12% assumed default rate, break-even at month 19.\n\nThere is no code: during the sprint we built the tariff model, a customer journey map, and a term sheet for a SACCO partner. The financing assumes a first-loss guarantee from a development partner that hasn't been approached yet.",
    disclosure_statement:
      "Before the event: research notes on SACCO lending from a university project. Built during the sprint: the tariff model, the customer journey map and the SACCO term sheet. Data: public FAO crop calendars. AI tools: Claude to edit the term sheet.",
    technologies_used: "Spreadsheet tariff model, mobile money (M-Pesa) collection, SACCO partnership",
    member1_name: "Achieng Ouma",
    member2_name: "Samuel Mutua",
    member3_name: "Grace Njeri",
    mentor_name: "Demo Mentor (Test)",
    ...drive("payday-power"),
    demo_video_url: yt("LTRaqeo_9i8"),
    demo_video_short_url: yt("r5e5DM3RMPM"),
    github_url: null,
    live_demo_url: "https://docs.google.com/spreadsheets/d/dua-sample-payday-power-model",
    linkedin_post_url: "https://www.linkedin.com/posts/dua-sample-payday-power",
  },
  {
    project_name: "ClinicLight (Sample)",
    team_name: "Midwife Power Collective",
    solo_or_team: "Team",
    team_size: 3,
    challenge_track: "Clean Energy & Sustainability Solutions",
    project_category: "Solar for health facilities",
    customer_type: "Non-residential",
    region: "Africa",
    country: "Nigeria",
    energy_sector: "Solar",
    impact_focus: "Availability, Energy Access",
    solution_stage: "Prototype",
    area_of_specification: "Environmental Friendliness",
    applies_ai: "No",
    target_region: "Primary health centres in northern Nigeria",
    core_energy_problem:
      "Night-time deliveries happen by phone torchlight because clinics can't afford diesel",
    problem_statement:
      "Many primary health centres have no reliable power after dark. Midwives deliver babies by phone torchlight, and vaccine fridges fail when the generator runs out of diesel.",
    project_description_summary:
      "A 1.2 kWp solar-and-battery kit that powers lights, a fetal Doppler and a vaccine fridge through the night, replacing a diesel generator.",
    project_description:
      "ClinicLight sizes a solar-plus-storage kit to a clinic's night-time loads: LED lighting for the delivery room, a fetal Doppler, phone charging and a solar direct-drive vaccine fridge.\n\nOur levelized cost comparison shows ~US$0.31/kWh against ~US$0.62/kWh for the clinic's current diesel generator, and the kit displaces about 1,100 litres of diesel a year.\n\nDuring the sprint we built the load profile, the sizing calculation and a bill of materials (US$3,400 per clinic). The state health ministry would pay for installation. We have not yet decided who maintains the batteries and inverter after installation.",
    disclosure_statement:
      "Before the event: nothing. Built during the sprint: the load profile, the sizing calculation, the bill of materials and the levelized-cost comparison. Data: NASA POWER solar irradiance; diesel prices from a 2025 market survey. No AI tools.",
    technologies_used: "1.2 kWp PV, 5 kWh LiFePO4, MPPT charge controller, solar direct-drive fridge",
    member1_name: "Halima Bello",
    member2_name: "Emeka Obi",
    member3_name: "Zainab Yusuf",
    mentor_name: "Demo Mentor (Test)",
    ...drive("cliniclight"),
    demo_video_url: yt("AaSaVlGHrmQ"),
    demo_video_short_url: null,
    github_url: "https://github.com/dua-sample/cliniclight-sizing",
    live_demo_url: null,
    linkedin_post_url: "https://www.linkedin.com/posts/dua-sample-cliniclight",
  },
  {
    project_name: "FairShare Bills (Sample)",
    team_name: null,
    solo_or_team: "Solo",
    team_size: 1,
    challenge_track: "Policy, Systems & Community-Based Solutions",
    project_category: "Utility affordability policy",
    customer_type: "Residential",
    region: "North America",
    country: "United States",
    energy_sector: "Energy Efficiency",
    impact_focus: "Affordability",
    solution_stage: "Idea / Concept",
    area_of_specification: "Policy and Regulation",
    applies_ai: "No",
    target_region: "Detroit, Michigan",
    core_energy_problem:
      "Low-income Detroit households spend more than 10% of their income on energy bills",
    problem_statement:
      "Two in five low-income U.S. households have a severe energy burden, spending more than 10% of income on energy. In Detroit, many fall behind every winter, face shutoffs, and never hear about weatherization help they qualify for.",
    project_description_summary:
      "A percentage-of-income payment plan that caps bills at 6% of income, with automatic enrolment and weatherization referrals.",
    project_description:
      "FairShare Bills proposes a percentage-of-income payment plan (PIPP) that caps energy bills at 6% of household income for households at or below 200% of the federal poverty level.\n\nThe mechanism: the utility files the program in its next rate case before the Michigan Public Service Commission; enrolment happens automatically through data-sharing with the state's SNAP and LIHEAP rolls, and every enrolled household gets a weatherization referral. Block clubs nominate residents to a community advisory board that reviews outcomes every quarter.\n\nDuring the sprint I drafted the program design, a cost estimate for 20,000 households, and a one-page brief for commissioners.",
    disclosure_statement:
      "Before the event: a 2025 blog post I wrote on Detroit utility shutoffs. Built during the sprint: the program design, the cost model and the commissioner brief. Data: ACS income data, LIHEAP enrolment figures and ACEEE energy-burden research. No AI tools.",
    technologies_used: "Policy design, program cost model, public data (ACS, LIHEAP)",
    member1_name: "Danielle Brooks",
    mentor_name: "Demo Mentor (Test)",
    ...drive("fairshare-bills"),
    demo_video_url: yt("d1HRPdbRrrQ"),
    demo_video_short_url: yt("WC7eFVIxMWY"),
    github_url: null,
    live_demo_url: null,
    linkedin_post_url: "https://www.linkedin.com/posts/dua-sample-fairshare-bills",
  },
  {
    project_name: "VillageVolt Co-op (Sample)",
    team_name: "Chikwawa Commons",
    solo_or_team: "Team",
    team_size: 4,
    challenge_track: "Policy, Systems & Community-Based Solutions",
    project_category: "Community-owned mini-grid",
    customer_type: "Residential",
    region: "Africa",
    country: "Malawi",
    energy_sector: "Energy Access / Off-Grid",
    impact_focus: "Energy Access, Affordability, Availability",
    solution_stage: "Idea / Concept",
    area_of_specification: "Policy and Regulation",
    applies_ai: "No",
    target_region: "Rural villages in southern Malawi",
    core_energy_problem:
      "Villages beyond the grid rely on kerosene and phone-charging kiosks, and private mini-grids stall on tariff approval",
    problem_statement:
      "Most rural Malawians have no electricity. Private mini-grid developers struggle to get tariffs approved and to keep community trust, so projects stall after the pilot.",
    project_description_summary:
      "A co-operative ownership and tariff-setting model that lets a village own its solar mini-grid.",
    project_description:
      "VillageVolt is a governance model for community ownership: villagers buy shares in a co-operative that owns the mini-grid, an elected tariff committee proposes tariffs to the regulator, and a local technician is trained and paid from tariff revenue.\n\nDuring the sprint we drafted the co-op by-laws, a tariff-committee charter, and a role-play of a village meeting voting on a tariff. We haven't estimated the cost of the mini-grid itself or how share purchases would be financed.",
    disclosure_statement:
      "Before the event: a by-law template from a farming co-operative one of us belongs to. Built during the sprint: the adapted by-laws, the tariff-committee charter and the village-meeting role-play. No AI tools or datasets.",
    technologies_used: "Governance design, community role-play, tariff framework",
    member1_name: "Chisomo Banda",
    member2_name: "Tiwonge Phiri",
    member3_name: "Kondwani Mwale",
    member4_name: "Mercy Chirwa",
    mentor_name: "Demo Mentor (Test)",
    ...drive("villagevolt"),
    demo_video_url: yt("ngk7VVyveu8"),
    demo_video_short_url: null,
    github_url: null,
    live_demo_url: null,
    linkedin_post_url: "https://www.linkedin.com/posts/dua-sample-villagevolt",
  },
];

// The one pre-filled score, so the dashboard shows a "Scored" row and the
// submission page shows Update Score. 1–5 per criterion with one sentence of
// evidence each (Judge Handbook §8, §13); totals 70 out of 100.
const SAMPLE_SCORE = {
  project_name: "FairShare Bills (Sample)",
  impact: 4,
  impact_evidence:
    "Impact (4): estimates 20,000 Detroit households capped at 6% of income, from ACS and LIHEAP data.",
  innovation: 3,
  innovation_evidence:
    "Innovation (3): PIPPs exist elsewhere; auto-enrolment through SNAP and LIHEAP data is the new combination.",
  sustainability: 4,
  sustainability_evidence:
    "Sustainability (4): funded through the rate case rather than a grant, with weatherization lowering bills over time.",
  feasibility: 3,
  feasibility_evidence:
    "Feasibility (3): names the decision-maker (Michigan PSC) and a cost model, but the data-sharing agreement is untested.",
  scalability: 3,
  scalability_evidence:
    "Scalability (3): could extend to other states with PIPP rules, but no plan beyond Detroit.",
};

// Which problem brief each sample worked on (0020). Keep these in step with
// PROBLEM_BRIEFS in src/lib/hackathon.ts.
const OWN = "Own problem (not one of the briefs)";
const BRIEFS = {
  "SunCold Hub (Sample)": "1 · Cold storage for clinics without reliable power",
  "GridSense (Sample)": "2 · Forecast demand before building a mini-grid",
  "PayDay Power (Sample)": OWN,
  "ClinicLight (Sample)": "4 · Keep a neighbourhood running through an outage",
  "FairShare Bills (Sample)": "3 · Lower energy bills for renters",
  "VillageVolt Co-op (Sample)": OWN,
};

const args = parseArgs(process.argv.slice(2));
const cleanup = args.cleanup === true;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  die("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY — pass --env-file=.env.local");

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Paginated, like findAuthUserIdByEmail in src/app/admin/actions.ts.
async function findAuthUserId(email) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) die(`listUsers: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function removeSampleSubmissions() {
  // Scores on these rows go with them (on delete cascade).
  const { data, error } = await supabase
    .from("submissions")
    .delete()
    .eq("review_note", DEMO_TAG)
    .select("project_name");
  if (error) die(`delete submissions: ${error.message}`);
  return data ?? [];
}

if (cleanup) {
  const removed = await removeSampleSubmissions();
  console.log(`✓ Removed ${removed.length} sample submission(s)`);
  for (const a of ACCOUNTS) {
    const id = await findAuthUserId(a.email);
    // Deleting the auth user cascades to the judges row and its scores.
    if (id) {
      const { error } = await supabase.auth.admin.deleteUser(id);
      if (error) die(`delete ${a.email}: ${error.message}`);
    }
    await supabase.from("judges").delete().eq("email", a.email);
    console.log(id ? `✓ Removed ${a.email}` : `· ${a.email} wasn't there`);
  }
  process.exit(0);
}

// ── accounts ─────────────────────────────────────────────────────
const created = [];
for (const a of ACCOUNTS) {
  const password = String(args[`${a.key}-password`] ?? "") || generatePassword();
  if (password.length < 6) die(`--${a.key}-password must be at least 6 characters`);

  let authUserId = await findAuthUserId(a.email);
  if (!authUserId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: a.email,
      email_confirm: true,
    });
    if (error || !data?.user?.id) die(`create ${a.email}: ${error?.message ?? "unknown"}`);
    authUserId = data.user.id;
  }
  const { error: pwdErr } = await supabase.auth.admin.updateUserById(authUserId, {
    password,
    email_confirm: true,
  });
  if (pwdErr) die(`set password for ${a.email}: ${pwdErr.message}`);

  const { data: judge, error } = await supabase
    .from("judges")
    .upsert(
      { auth_user_id: authUserId, name: a.name, email: a.email, role: a.role, is_active: true },
      { onConflict: "email" },
    )
    .select("id")
    .single();
  if (error) die(`roster ${a.email}: ${error.message}`);
  created.push({ ...a, password, judgeId: judge.id });
}

// ── submissions ──────────────────────────────────────────────────
await removeSampleSubmissions();
const rows = SAMPLES.map((s, i) => ({
  ...s,
  member1_email: `sample.team${i + 1}@example.com`,
  problem_brief: BRIEFS[s.project_name],
  is_submission_complete: true,
  needs_review: false,
  hidden_from_judges: false,
  review_note: DEMO_TAG,
}));
const { data: inserted, error: insErr } = await supabase
  .from("submissions")
  .insert(rows)
  .select("id, project_name");
if (insErr) {
  if (insErr.code === "23505")
    die(`a submission with one of these names already exists and isn't a sample: ${insErr.message}`);
  die(`insert submissions: ${insErr.message}`);
}
console.log(`✓ Seeded ${inserted.length} sample submissions`);

// ── one pre-filled score ─────────────────────────────────────────
const judge = created.find((c) => c.key === "judge");
const target = inserted.find((s) => s.project_name === SAMPLE_SCORE.project_name);
const { project_name: _, ...scoreValues } = SAMPLE_SCORE;
const { error: scoreErr } = await supabase
  .from("scores")
  .upsert(
    { judge_id: judge.judgeId, submission_id: target.id, ...scoreValues },
    { onConflict: "judge_id,submission_id" },
  );
if (scoreErr) die(`seed score: ${scoreErr.message}`);
console.log(`✓ Scored "${SAMPLE_SCORE.project_name}" as ${judge.name}`);

console.log("\nSign in at /judge (passwords shown once):");
for (const c of created) console.log(`  ${c.role.padEnd(6)}  ${c.email}  ${c.password}`);
console.log("\nRemove it all with: node --env-file=.env.local scripts/demo-data.mjs --cleanup");
