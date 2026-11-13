CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_protected" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_role_check" CHECK ("admin_users"."role" in ('owner', 'admin', 'viewer'))
);
--> statement-breakpoint
CREATE TABLE "email_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"body_html" text NOT NULL,
	"audience" text DEFAULT 'all' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"error_detail" text,
	"sent_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_campaigns_audience_check" CHECK ("email_campaigns"."audience" in ('all', 'participant', 'mentor', 'admins', 'super_admins')),
	CONSTRAINT "email_campaigns_status_check" CHECK ("email_campaigns"."status" in ('draft', 'sending', 'sent', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"phase" text DEFAULT 'submissions' NOT NULL,
	"submissions_open" boolean DEFAULT false NOT NULL,
	"registration_open" boolean DEFAULT false NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_phase_check" CHECK ("events"."phase" in ('submissions', 'judging', 'results'))
);
--> statement-breakpoint
CREATE TABLE "judges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'judge' NOT NULL,
	"password_hash" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "judges_role_check" CHECK ("judges"."role" in ('judge', 'mentor'))
);
--> statement-breakpoint
CREATE TABLE "recusals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"judge_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recusals_judge_submission_uniq" UNIQUE("judge_id","submission_id")
);
--> statement-breakpoint
CREATE TABLE "registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"role" text DEFAULT 'participant' NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"country" text,
	"participating_as" text,
	"team_name" text,
	"primary_interest" text,
	"experience_level" text,
	"organization" text,
	"occupation" text,
	"partner_org" text,
	"linkedin_url" text,
	"website_url" text,
	"heard_about" text,
	"referred_by" text,
	"unsubscribed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registrations_role_check" CHECK ("registrations"."role" in ('participant', 'mentor')),
	CONSTRAINT "registrations_participating_as_check" CHECK ("registrations"."participating_as" is null or "registrations"."participating_as" in ('Solo', 'Team'))
);
--> statement-breakpoint
CREATE TABLE "results_locks" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"seed" bigint NOT NULL,
	"top6" jsonb NOT NULL,
	"locked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"judge_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"impact" integer NOT NULL,
	"innovation" integer NOT NULL,
	"sustainability" integer NOT NULL,
	"feasibility" integer NOT NULL,
	"scalability" integer NOT NULL,
	"impact_evidence" text,
	"innovation_evidence" text,
	"sustainability_evidence" text,
	"feasibility_evidence" text,
	"scalability_evidence" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scores_judge_submission_uniq" UNIQUE("judge_id","submission_id"),
	CONSTRAINT "scores_range_check" CHECK ("scores"."impact" between 1 and 5
        and "scores"."innovation" between 1 and 5
        and "scores"."sustainability" between 1 and 5
        and "scores"."feasibility" between 1 and 5
        and "scores"."scalability" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "sign_in_failures" (
	"key" text NOT NULL,
	"failed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seq" bigint GENERATED ALWAYS AS IDENTITY (sequence name "sign_in_failures_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	CONSTRAINT "sign_in_failures_seq_pk" PRIMARY KEY("seq")
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"project_name" text NOT NULL,
	"team_name" text,
	"solo_or_team" text,
	"team_size" integer,
	"challenge_track" text,
	"problem_brief" text,
	"project_category" text,
	"project_description" text,
	"project_description_summary" text,
	"problem_statement" text,
	"technologies_used" text,
	"disclosure_statement" text,
	"applies_ai" text,
	"solution_stage" text,
	"customer_type" text,
	"region" text,
	"target_region" text,
	"area_of_specification" text,
	"focus_area" text,
	"impact_focus" text,
	"core_problem" text,
	"github_url" text,
	"live_demo_url" text,
	"demo_video_url" text,
	"demo_video_short_url" text,
	"pitch_deck_url" text,
	"summary_url" text,
	"linkedin_post_url" text,
	"all_members_in_video" text,
	"member1_name" text,
	"member1_email" text,
	"phone" text,
	"country" text,
	"state_region" text,
	"city" text,
	"affiliated_org" text,
	"submitter_role" text,
	"submitter_linkedin_url" text,
	"member2_name" text,
	"member2_email" text,
	"member2_linkedin_url" text,
	"member2_occupation" text,
	"member2_country" text,
	"member3_name" text,
	"member3_email" text,
	"member3_linkedin_url" text,
	"member3_occupation" text,
	"member3_country" text,
	"member4_name" text,
	"member4_email" text,
	"member4_linkedin_url" text,
	"member4_occupation" text,
	"member4_country" text,
	"member5_name" text,
	"member5_email" text,
	"member5_linkedin_url" text,
	"member5_occupation" text,
	"member5_country" text,
	"participants" text,
	"mentor_name" text,
	"mentor_linkedin_url" text,
	"is_submission_complete" boolean DEFAULT true NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"review_note" text,
	"hidden_from_judges" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submissions_solo_or_team_check" CHECK ("submissions"."solo_or_team" is null or "submissions"."solo_or_team" in ('Solo', 'Team'))
);
--> statement-breakpoint
CREATE TABLE "tie_breaks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"winning_submission_id" uuid NOT NULL,
	"losing_submission_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"decided_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"content_type" text NOT NULL,
	"bytes" "bytea" NOT NULL,
	"size" integer NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judges" ADD CONSTRAINT "judges_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recusals" ADD CONSTRAINT "recusals_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recusals" ADD CONSTRAINT "recusals_judge_id_judges_id_fk" FOREIGN KEY ("judge_id") REFERENCES "public"."judges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recusals" ADD CONSTRAINT "recusals_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "results_locks" ADD CONSTRAINT "results_locks_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_judge_id_judges_id_fk" FOREIGN KEY ("judge_id") REFERENCES "public"."judges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tie_breaks" ADD CONSTRAINT "tie_breaks_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tie_breaks" ADD CONSTRAINT "tie_breaks_winning_submission_id_submissions_id_fk" FOREIGN KEY ("winning_submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tie_breaks" ADD CONSTRAINT "tie_breaks_losing_submission_id_submissions_id_fk" FOREIGN KEY ("losing_submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_users_email_uniq" ON "admin_users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "email_campaigns_event_created_idx" ON "email_campaigns" USING btree ("event_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "events_slug_uniq" ON "events" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "judges_event_email_uniq" ON "judges" USING btree ("event_id",lower("email"));--> statement-breakpoint
CREATE INDEX "recusals_submission_idx" ON "recusals" USING btree ("submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "registrations_event_email_role_uniq" ON "registrations" USING btree ("event_id",lower("email"),"role");--> statement-breakpoint
CREATE INDEX "registrations_event_created_idx" ON "registrations" USING btree ("event_id","created_at");--> statement-breakpoint
CREATE INDEX "scores_submission_idx" ON "scores" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "scores_event_idx" ON "scores" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "sign_in_failures_key_idx" ON "sign_in_failures" USING btree ("key","failed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_event_project_name_uniq" ON "submissions" USING btree ("event_id",lower("project_name"));--> statement-breakpoint
CREATE INDEX "submissions_event_created_idx" ON "submissions" USING btree ("event_id","created_at");