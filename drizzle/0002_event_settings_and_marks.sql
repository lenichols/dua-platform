ALTER TABLE "events" ADD COLUMN "settings" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "scores" ADD COLUMN "marks" jsonb;--> statement-breakpoint
ALTER TABLE "scores" ADD COLUMN "evidence" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
-- Carry existing scores over from the fixed columns.
UPDATE "scores" SET
  "marks" = jsonb_build_object(
    'impact', "impact",
    'innovation', "innovation",
    'sustainability', "sustainability",
    'feasibility', "feasibility",
    'scalability', "scalability"
  ),
  "evidence" = jsonb_strip_nulls(jsonb_build_object(
    'impact', "impact_evidence",
    'innovation', "innovation_evidence",
    'sustainability', "sustainability_evidence",
    'feasibility', "feasibility_evidence",
    'scalability', "scalability_evidence"
  ))
WHERE "marks" IS NULL;
