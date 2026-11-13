// The whole database, in one place. `npm run db:generate` turns changes here
// into a SQL migration under drizzle/.
//
// Property names match column names (snake_case) on purpose: validated form
// data can be inserted as-is, and rows reach the UI in the shape it expects.
//
// Every table that holds event data carries event_id, so one database can
// hold more than one event. admin_users is the exception: an admin account
// belongs to the deployment, not to a single event.
//
// Row-level security is switched on for every table, with no policies. The
// app connects as the tables' owner, which Postgres lets straight through, so
// nothing changes for it. What it closes is the side door on hosts such as
// Supabase, which publish every table in the public schema through an API of
// their own: with this on, that API returns nothing.

import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ── events ───────────────────────────────────────────────────────
// One row per hackathon. Also holds the switches an organizer flips while the
// event runs.

export const events = pgTable(
  "events",
  {
    id: id(),
    /** Short name for URLs and config, e.g. "default". */
    slug: text("slug").notNull(),
    phase: text("phase").notNull().default("submissions"),
    /** The project submission form. Closed until an admin opens it. */
    submissions_open: boolean("submissions_open").notNull().default(false),
    /** Participant registration and mentor sign-up. */
    registration_open: boolean("registration_open").notNull().default(false),
    closed_at: timestamp("closed_at", { withTimezone: true }),
    /**
     * Name, dates, option lists, homepage copy and rubric: everything an
     * organizer edits. See src/lib/event-settings.ts. Missing values fall
     * back to the defaults there.
     */
    settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [
    uniqueIndex("events_slug_uniq").on(t.slug),
    check("events_phase_check", sql`${t.phase} in ('submissions', 'judging', 'results')`),
  ],
).enableRLS();

const eventId = () =>
  uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" });

// ── registrations ────────────────────────────────────────────────
// Public sign-ups: participants and volunteer mentors. Personal details, so
// only admins ever read this table.

export const registrations = pgTable(
  "registrations",
  {
    id: id(),
    event_id: eventId(),
    role: text("role").notNull().default("participant"),
    full_name: text("full_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    country: text("country"),
    participating_as: text("participating_as"),
    team_name: text("team_name"),
    primary_interest: text("primary_interest"),
    experience_level: text("experience_level"),
    organization: text("organization"),
    occupation: text("occupation"),
    partner_org: text("partner_org"),
    linkedin_url: text("linkedin_url"),
    website_url: text("website_url"),
    heard_about: text("heard_about"),
    referred_by: text("referred_by"),
    /** Answers to questions the organizer added, by question key. */
    custom: jsonb("custom").$type<Record<string, string>>().notNull().default({}),
    unsubscribed_at: timestamp("unsubscribed_at", { withTimezone: true }),
    created_at: createdAt(),
  },
  (t) => [
    // Someone can sign up once as a participant and once as a mentor.
    uniqueIndex("registrations_event_email_role_uniq").on(
      t.event_id,
      sql`lower(${t.email})`,
      t.role,
    ),
    index("registrations_event_created_idx").on(t.event_id, t.created_at),
    check("registrations_role_check", sql`${t.role} in ('participant', 'mentor')`),
    check(
      "registrations_participating_as_check",
      sql`${t.participating_as} is null or ${t.participating_as} in ('Solo', 'Team')`,
    ),
  ],
).enableRLS();

// ── submissions ──────────────────────────────────────────────────

export const submissions = pgTable(
  "submissions",
  {
    id: id(),
    event_id: eventId(),

    // The project
    project_name: text("project_name").notNull(),
    team_name: text("team_name"),
    solo_or_team: text("solo_or_team"),
    team_size: integer("team_size"),
    challenge_track: text("challenge_track"),
    problem_brief: text("problem_brief"),
    project_category: text("project_category"),
    project_description: text("project_description"),
    project_description_summary: text("project_description_summary"),
    problem_statement: text("problem_statement"),
    technologies_used: text("technologies_used"),
    disclosure_statement: text("disclosure_statement"),
    applies_ai: text("applies_ai"),
    solution_stage: text("solution_stage"),
    customer_type: text("customer_type"),
    region: text("region"),
    target_region: text("target_region"),
    area_of_specification: text("area_of_specification"),
    focus_area: text("focus_area"),
    impact_focus: text("impact_focus"),
    core_problem: text("core_problem"),

    // Links
    github_url: text("github_url"),
    live_demo_url: text("live_demo_url"),
    demo_video_url: text("demo_video_url"),
    demo_video_short_url: text("demo_video_short_url"),
    pitch_deck_url: text("pitch_deck_url"),
    summary_url: text("summary_url"),
    linkedin_post_url: text("linkedin_post_url"),
    all_members_in_video: text("all_members_in_video"),

    // The submitter (member 1). Contact details: admins only.
    member1_name: text("member1_name"),
    member1_email: text("member1_email"),
    phone: text("phone"),
    country: text("country"),
    state_region: text("state_region"),
    city: text("city"),
    affiliated_org: text("affiliated_org"),
    submitter_role: text("submitter_role"),
    submitter_linkedin_url: text("submitter_linkedin_url"),

    // Team mates. Names are shown to judges; the rest is admins only.
    member2_name: text("member2_name"),
    member2_email: text("member2_email"),
    member2_linkedin_url: text("member2_linkedin_url"),
    member2_occupation: text("member2_occupation"),
    member2_country: text("member2_country"),
    member3_name: text("member3_name"),
    member3_email: text("member3_email"),
    member3_linkedin_url: text("member3_linkedin_url"),
    member3_occupation: text("member3_occupation"),
    member3_country: text("member3_country"),
    member4_name: text("member4_name"),
    member4_email: text("member4_email"),
    member4_linkedin_url: text("member4_linkedin_url"),
    member4_occupation: text("member4_occupation"),
    member4_country: text("member4_country"),
    member5_name: text("member5_name"),
    member5_email: text("member5_email"),
    member5_linkedin_url: text("member5_linkedin_url"),
    member5_occupation: text("member5_occupation"),
    member5_country: text("member5_country"),
    participants: text("participants"),

    mentor_name: text("mentor_name"),
    mentor_linkedin_url: text("mentor_linkedin_url"),

    /** Answers to questions the organizer added, by question key. */
    custom: jsonb("custom").$type<Record<string, string>>().notNull().default({}),

    // Organizer controls
    is_submission_complete: boolean("is_submission_complete").notNull().default(true),
    needs_review: boolean("needs_review").notNull().default(false),
    review_note: text("review_note"),
    hidden_from_judges: boolean("hidden_from_judges").notNull().default(false),

    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [
    // One submission per project name within an event.
    uniqueIndex("submissions_event_project_name_uniq").on(
      t.event_id,
      sql`lower(${t.project_name})`,
    ),
    index("submissions_event_created_idx").on(t.event_id, t.created_at),
    check(
      "submissions_solo_or_team_check",
      sql`${t.solo_or_team} is null or ${t.solo_or_team} in ('Solo', 'Team')`,
    ),
  ],
).enableRLS();

// ── judges ───────────────────────────────────────────────────────
// Judges score. Mentors (role = 'mentor') can read submissions but not score.

export const judges = pgTable(
  "judges",
  {
    id: id(),
    event_id: eventId(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull().default("judge"),
    /** scrypt hash. Null until an admin sets a password. */
    password_hash: text("password_hash"),
    is_active: boolean("is_active").notNull().default(true),
    created_at: createdAt(),
  },
  (t) => [
    uniqueIndex("judges_event_email_uniq").on(t.event_id, sql`lower(${t.email})`),
    check("judges_role_check", sql`${t.role} in ('judge', 'mentor')`),
  ],
).enableRLS();

// ── scores ───────────────────────────────────────────────────────
// One row per judge per submission. Which criteria there are comes from the
// event's rubric (in its settings), so marks and evidence are stored by
// criterion key rather than in fixed columns.

export const scores = pgTable(
  "scores",
  {
    id: id(),
    event_id: eventId(),
    judge_id: uuid("judge_id")
      .notNull()
      .references(() => judges.id, { onDelete: "cascade" }),
    submission_id: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    /** The mark for each criterion on the event's rubric, by criterion key. */
    marks: jsonb("marks").$type<Record<string, number>>().notNull(),
    /** One sentence of evidence per criterion, by criterion key. */
    evidence: jsonb("evidence").$type<Record<string, string>>().notNull().default({}),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [
    unique("scores_judge_submission_uniq").on(t.judge_id, t.submission_id),
    index("scores_submission_idx").on(t.submission_id),
    index("scores_event_idx").on(t.event_id),
  ],
).enableRLS();

// ── recusals ─────────────────────────────────────────────────────
// A judge's declared conflict of interest with a submission.

export const recusals = pgTable(
  "recusals",
  {
    id: id(),
    event_id: eventId(),
    judge_id: uuid("judge_id")
      .notNull()
      .references(() => judges.id, { onDelete: "cascade" }),
    submission_id: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    reason: text("reason"),
    created_at: createdAt(),
  },
  (t) => [
    unique("recusals_judge_submission_uniq").on(t.judge_id, t.submission_id),
    index("recusals_submission_idx").on(t.submission_id),
  ],
).enableRLS();

// ── results ──────────────────────────────────────────────────────

export type LockedPlace = { submission_id: string; rank: number; probability: number };

/** The locked final ranking for an event, with the seed that reproduces it. */
export const results_locks = pgTable("results_locks", {
  event_id: uuid("event_id")
    .primaryKey()
    .references(() => events.id, { onDelete: "cascade" }),
  seed: bigint("seed", { mode: "number" }).notNull(),
  top6: jsonb("top6").$type<LockedPlace[]>().notNull(),
  locked_at: timestamp("locked_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

/** A tie the panel settled by vote. */
export const tie_breaks = pgTable("tie_breaks", {
  id: id(),
  event_id: eventId(),
  winning_submission_id: uuid("winning_submission_id")
    .notNull()
    .references(() => submissions.id, { onDelete: "cascade" }),
  losing_submission_id: uuid("losing_submission_id")
    .notNull()
    .references(() => submissions.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  decided_by: text("decided_by").notNull(),
  created_at: createdAt(),
}).enableRLS();

// ── admin accounts ───────────────────────────────────────────────

export const admin_users = pgTable(
  "admin_users",
  {
    id: id(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    password_hash: text("password_hash").notNull(),
    role: text("role").notNull().default("viewer"),
    is_active: boolean("is_active").notNull().default(true),
    /** Super administrator: only another one can change or remove them. */
    is_protected: boolean("is_protected").notNull().default(false),
    created_by: text("created_by"),
    last_login_at: timestamp("last_login_at", { withTimezone: true }),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [
    uniqueIndex("admin_users_email_uniq").on(sql`lower(${t.email})`),
    check("admin_users_role_check", sql`${t.role} in ('owner', 'admin', 'viewer')`),
  ],
).enableRLS();

// ── email campaigns ──────────────────────────────────────────────

export const email_campaigns = pgTable(
  "email_campaigns",
  {
    id: id(),
    event_id: eventId(),
    subject: text("subject").notNull(),
    body_html: text("body_html").notNull(),
    audience: text("audience").notNull().default("all"),
    status: text("status").notNull().default("draft"),
    recipient_count: integer("recipient_count").notNull().default(0),
    sent_count: integer("sent_count").notNull().default(0),
    failed_count: integer("failed_count").notNull().default(0),
    error_detail: text("error_detail"),
    sent_at: timestamp("sent_at", { withTimezone: true }),
    created_by: text("created_by"),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [
    index("email_campaigns_event_created_idx").on(t.event_id, t.created_at),
    check(
      "email_campaigns_audience_check",
      sql`${t.audience} in ('all', 'participant', 'mentor', 'admins', 'super_admins')`,
    ),
    check(
      "email_campaigns_status_check",
      sql`${t.status} in ('draft', 'sending', 'sent', 'failed')`,
    ),
  ],
).enableRLS();

// ── uploads ──────────────────────────────────────────────────────
// Small public files, such as images in campaign emails, stored in the
// database so a fresh install needs no file storage service.

export const uploads = pgTable("uploads", {
  id: id(),
  event_id: eventId(),
  content_type: text("content_type").notNull(),
  bytes: bytea("bytes").notNull(),
  size: integer("size").notNull(),
  created_by: text("created_by"),
  created_at: createdAt(),
}).enableRLS();

// ── sign-in attempts ─────────────────────────────────────────────
// Failed sign-ins, kept briefly, so repeated password guessing can be slowed.

export const sign_in_failures = pgTable(
  "sign_in_failures",
  {
    /** What is being guessed at, e.g. "judge:someone@example.org". */
    key: text("key").notNull(),
    failed_at: timestamp("failed_at", { withTimezone: true }).notNull().defaultNow(),
    seq: bigint("seq", { mode: "number" }).generatedAlwaysAsIdentity(),
  },
  (t) => [
    primaryKey({ columns: [t.seq] }),
    index("sign_in_failures_key_idx").on(t.key, t.failed_at),
  ],
).enableRLS();
