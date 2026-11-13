ALTER TABLE "registrations" ADD COLUMN "custom" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "custom" jsonb DEFAULT '{}'::jsonb NOT NULL;