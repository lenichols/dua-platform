// Reading and saving an event's settings: its name, dates, option lists,
// homepage copy and rubric. The shape and the defaults are in
// src/lib/event-settings.ts.

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { events, scores } from "@/db/schema";
import { settingsSchema, type EventSettings, type Rubric } from "@/lib/event-settings";
import { getCurrentEvent, type EventRow } from "./event";

/** The settings of the event this deployment serves. */
export async function getEventSettings(): Promise<EventSettings> {
  return (await getCurrentEvent()).settings;
}

// What each setting is called in the admin panel, for error messages.
const LABELS: Record<string, string> = {
  name: "Event name",
  accentWord: "Word to highlight",
  tagline: "Tagline",
  description: "Description",
  dates: "Dates",
  submissionDeadline: "Submission deadline",
  judgingOpens: "Judging opens",
  format: "Format",
  prizes: "Prizes",
  maxTeamSize: "Largest team size",
  host: "Host",
  contactEmail: "Contact email",
  announceUrl: "Page teams tag when announcing",
  topN: "Places in the final ranking",
  rubric: "Rubric",
  theme: "Look",
  tracks: "Challenge tracks",
  problemBriefs: "Problem briefs",
  home: "Homepage",
};

function labelFor(path: (string | number)[]): string {
  const [first] = path;
  return LABELS[String(first)] ?? (first === undefined ? "Settings" : String(first));
}

/** What scoring depends on: the criteria and how much each counts. */
function scoringShape(rubric: Rubric): string {
  return JSON.stringify(rubric.criteria.map((c) => [c.key, c.weight]));
}

export async function hasScores(eventId: string): Promise<boolean> {
  const [row] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(scores)
    .where(eq(scores.event_id, eventId));
  return Number(row?.n ?? 0) > 0;
}

export type SaveSettingsResult =
  | { ok: true; settings: EventSettings }
  | { ok: false; error: string; issues: { path: string; message: string }[] };

/**
 * Replace an event's settings. Everything is checked first; nothing is saved
 * if anything is invalid.
 *
 * Once judges have started scoring, the rubric's criteria and weights are
 * fixed: changing them would make scores already given mean something else.
 * Labels and guidance text can still be edited.
 */
export async function saveEventSettings(
  event: EventRow,
  input: unknown,
): Promise<SaveSettingsResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: first ? `${labelFor(first.path)}: ${first.message}` : "Check the settings.",
      issues,
    };
  }
  const next = parsed.data;

  if (
    scoringShape(next.rubric) !== scoringShape(event.settings.rubric) &&
    (await hasScores(event.id))
  ) {
    return {
      ok: false,
      error:
        "Judges have already started scoring, so the rubric's criteria and weights can't change. You can still edit labels and guidance.",
      issues: [{ path: "rubric", message: "Locked once scoring has started" }],
    };
  }

  await db().update(events).set({ settings: next }).where(eq(events.id, event.id));
  return { ok: true, settings: next };
}
