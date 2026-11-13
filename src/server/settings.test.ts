import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_RUBRIC, DEFAULT_SETTINGS } from "@/lib/event-settings";
import { makeEvent, makeJudge, makeSubmission, resetDb, scoreOf } from "../../test/fixtures";
import { getEventBySlug } from "./event";
import { saveScore } from "./judging";
import { hasScores, saveEventSettings } from "./settings";

beforeEach(resetDb);

const reload = async (slug: string) => (await getEventBySlug(slug))!;

describe("event settings", () => {
  it("start as the defaults for a new event", async () => {
    const event = await makeEvent();
    expect(event.settings).toEqual(DEFAULT_SETTINGS);
  });

  it("are saved and read back, separately for each event", async () => {
    const one = await makeEvent();
    const two = await makeEvent();
    const saved = await saveEventSettings(one, {
      ...DEFAULT_SETTINGS,
      name: "City Hack Weekend",
      tracks: ["Transit", "Housing"],
      topN: 3,
    });
    expect(saved.ok).toBe(true);
    const again = await reload(one.slug);
    expect(again.settings.name).toBe("City Hack Weekend");
    expect(again.settings.tracks).toEqual(["Transit", "Housing"]);
    expect(again.settings.topN).toBe(3);
    expect((await reload(two.slug)).settings.name).toBe(DEFAULT_SETTINGS.name);
  });

  it("refuse invalid settings and save nothing", async () => {
    const event = await makeEvent();
    for (const bad of [
      { ...DEFAULT_SETTINGS, name: "" },
      { ...DEFAULT_SETTINGS, topN: 0 },
      { ...DEFAULT_SETTINGS, maxTeamSize: 9 },
      { ...DEFAULT_SETTINGS, tracks: ["Fine", ""] },
      {
        ...DEFAULT_SETTINGS,
        rubric: {
          ...DEFAULT_RUBRIC,
          criteria: DEFAULT_RUBRIC.criteria.map((c, i) => (i === 0 ? { ...c, weight: 30 } : c)),
        },
      },
      null,
    ]) {
      const r = await saveEventSettings(event, bad);
      expect(r.ok).toBe(false);
    }
    expect((await reload(event.slug)).settings).toEqual(DEFAULT_SETTINGS);
  });

  it("say which setting is wrong", async () => {
    const event = await makeEvent();
    const r = await saveEventSettings(event, { ...DEFAULT_SETTINGS, name: "" });
    expect(r.ok === false && r.error).toBe("Event name: This can't be empty");
  });
});

describe("the rubric once scoring has started", () => {
  async function scoredEvent() {
    const event = await makeEvent({ phase: "judging" });
    const submission = await makeSubmission(event);
    const { viewer } = await makeJudge(event);
    expect(await hasScores(event.id)).toBe(false);
    await saveScore(event, viewer, submission, scoreOf(4));
    expect(await hasScores(event.id)).toBe(true);
    return event;
  }

  it("can't have criteria added, removed or re-weighted", async () => {
    const event = await scoredEvent();
    const [first, second, ...rest] = DEFAULT_RUBRIC.criteria;
    const reweighted = {
      ...DEFAULT_RUBRIC,
      criteria: [{ ...first, weight: first.weight + 5 }, { ...second, weight: second.weight - 5 }, ...rest],
    };
    const removed = {
      criteria: [{ ...first, weight: first.weight + rest[rest.length - 1].weight }, second, ...rest.slice(0, -1)],
      tieBreakers: [],
    };
    for (const rubric of [reweighted, removed]) {
      const r = await saveEventSettings(event, { ...DEFAULT_SETTINGS, rubric });
      expect(r.ok === false && r.error).toContain("already started scoring");
    }
    expect((await reload(event.slug)).settings.rubric).toEqual(DEFAULT_RUBRIC);
  });

  it("can still have its wording changed, along with everything else", async () => {
    const event = await scoredEvent();
    const rubric = {
      ...DEFAULT_RUBRIC,
      criteria: DEFAULT_RUBRIC.criteria.map((c, i) => (i === 0 ? { ...c, label: "Real-world impact" } : c)),
    };
    const r = await saveEventSettings(event, { ...DEFAULT_SETTINGS, name: "Renamed", rubric });
    expect(r.ok).toBe(true);
    const again = await reload(event.slug);
    expect(again.settings.rubric.criteria[0].label).toBe("Real-world impact");
    expect(again.settings.name).toBe("Renamed");
  });

  it("can be changed freely before any score exists", async () => {
    const event = await makeEvent({ phase: "judging" });
    const rubric = {
      criteria: [
        { key: "craft", label: "Craft", weight: 60, anchors: { limited: "", solid: "", exceptional: "" }, example: "" },
        { key: "story", label: "Story", weight: 40, anchors: { limited: "", solid: "", exceptional: "" }, example: "" },
      ],
      tieBreakers: ["craft"],
    };
    expect((await saveEventSettings(event, { ...DEFAULT_SETTINGS, rubric })).ok).toBe(true);
    expect((await reload(event.slug)).settings.rubric.criteria.map((c) => c.key)).toEqual(["craft", "story"]);
  });
});
