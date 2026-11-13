// The sample event's rubric: five criteria scored 1–5, each with one
// sentence of evidence. Weights are percentages and must stay in sync with
// rubric_aggregates() in 0020_handbook_v2_rubric.sql.
export type RubricCategory =
  | "impact"
  | "innovation"
  | "sustainability"
  | "feasibility"
  | "scalability";

export type EvidenceKey = `${RubricCategory}_evidence`;

export type Criterion = {
  key: RubricCategory;
  label: string;
  weight: number;
  anchors: { limited: string; solid: string; exceptional: string };
  example: string;
};

export const SCALE_MAX = 5;

export const RUBRIC: Criterion[] = [
  {
    key: "impact",
    label: "Impact",
    weight: 25,
    anchors: {
      limited: "Benefit is vague or not quantified; unclear who gains",
      solid: "Clear benefit to a named group, estimated with rough numbers",
      exceptional:
        "Large, quantified benefit to the people it's built for, backed by real data or real users",
    },
    example:
      "Impact (4): tested with six volunteers at one food bank; unfilled shifts fell from nine a week to two.",
  },
  {
    key: "innovation",
    label: "Innovation",
    weight: 25,
    anchors: {
      limited: "Repeats an existing product or approach",
      solid: "Meaningful improvement or new combination of known approaches",
      exceptional:
        "Genuinely new approach that addresses a root cause existing solutions miss",
    },
    example:
      "Innovation (5): works entirely by voice, for riders the existing transit apps leave out.",
  },
  {
    key: "sustainability",
    label: "Sustainability",
    weight: 25,
    anchors: {
      limited: "Stops working when the team stops; no plan for cost or upkeep",
      solid: "Plausible plan for who runs it and how its costs are covered",
      exceptional:
        "Cheap to run, simple to maintain, and someone other than the team could keep it going",
    },
    example:
      "Sustainability (2): depends on a paid API with no budget and no one named to maintain it.",
  },
  {
    key: "feasibility",
    label: "Feasibility",
    weight: 15,
    anchors: {
      limited: "Major technical, legal, or data gaps; prototype does not run",
      solid: "Prototype works on sample data; main risks named",
      exceptional:
        "Working prototype on real or realistic data, with a clear path to a first real user",
    },
    example:
      "Feasibility (2): the demo runs only on invented data and the main feature is mocked.",
  },
  {
    key: "scalability",
    label: "Scalability",
    weight: 10,
    anchors: {
      limited: "Works only for one user or one place under special conditions",
      solid: "Could extend to similar users or places with some adaptation",
      exceptional:
        "Clear plan to reach many more users, with costs that fall as it grows",
    },
    example:
      "Scalability (3): could serve other food banks, but each one needs manual setup.",
  },
];

// Ties are broken by Impact, then Innovation .
export const TIE_BREAKERS: RubricCategory[] = ["impact", "innovation"];

export const evidenceKey = (k: RubricCategory): EvidenceKey => `${k}_evidence`;

/** Total out of 100: 20 × the weighted sum of the 1–5 scores. */
export function totalScore(
  values: Partial<Record<RubricCategory, number | null>>,
): number {
  return (
    (100 / SCALE_MAX) *
    RUBRIC.reduce((t, c) => t + ((values[c.key] ?? 0) * c.weight) / 100, 0)
  );
}
