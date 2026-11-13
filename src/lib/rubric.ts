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
        "Large, quantified benefit to the people in the brief, backed by real data and the brief's impact metric",
    },
    example:
      "Impact (4): estimates 3,400 households enrolled using the brief's metric, from state program data.",
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
      "Innovation (5): a service-and-funding model that keeps clinic fridges running after warranties end, not just a new fridge.",
  },
  {
    key: "sustainability",
    label: "Sustainability (incl. affordability)",
    weight: 25,
    anchors: {
      limited:
        "Depends on ongoing grants or subsidy; unaffordable for the people it serves",
      solid: "Plausible path to cover costs; affordable to users with some support",
      exceptional:
        "Pays for itself over its life, affordable to the lowest-income users, maintainable locally, and lowers environmental impact",
    },
    example:
      "Sustainability (2): $1,200 per household with no payment path the lowest-income users in the brief can afford.",
  },
  {
    key: "feasibility",
    label: "Feasibility",
    weight: 15,
    anchors: {
      limited: "Major technical, legal, or data gaps; prototype does not run",
      solid: "Prototype works on sample data; main risks named",
      exceptional:
        "Working prototype on real or realistic data; complies with relevant standards and rules; clear path to a pilot",
    },
    example:
      "Feasibility (2): prototype runs only on invented data; no sizing check against the worst solar month.",
  },
  {
    key: "scalability",
    label: "Scalability",
    weight: 10,
    anchors: {
      limited: "Works only in one site under special conditions",
      solid: "Could extend to similar sites with adaptation",
      exceptional:
        "Clear plan to replicate across sites, utilities, or countries, with costs that fall at scale",
    },
    example:
      "Scalability (3): could extend to similar villages, but no cost estimate beyond the first site.",
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
