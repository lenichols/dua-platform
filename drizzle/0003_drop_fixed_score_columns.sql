ALTER TABLE "scores" DROP CONSTRAINT "scores_range_check";--> statement-breakpoint
ALTER TABLE "scores" ALTER COLUMN "marks" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "scores" DROP COLUMN "impact";--> statement-breakpoint
ALTER TABLE "scores" DROP COLUMN "innovation";--> statement-breakpoint
ALTER TABLE "scores" DROP COLUMN "sustainability";--> statement-breakpoint
ALTER TABLE "scores" DROP COLUMN "feasibility";--> statement-breakpoint
ALTER TABLE "scores" DROP COLUMN "scalability";--> statement-breakpoint
ALTER TABLE "scores" DROP COLUMN "impact_evidence";--> statement-breakpoint
ALTER TABLE "scores" DROP COLUMN "innovation_evidence";--> statement-breakpoint
ALTER TABLE "scores" DROP COLUMN "sustainability_evidence";--> statement-breakpoint
ALTER TABLE "scores" DROP COLUMN "feasibility_evidence";--> statement-breakpoint
ALTER TABLE "scores" DROP COLUMN "scalability_evidence";