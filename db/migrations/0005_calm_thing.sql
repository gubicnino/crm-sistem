CREATE TABLE "email_sequence_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trainer_id" uuid NOT NULL,
	"sequence_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"day_offset" integer NOT NULL,
	"subject" text NOT NULL,
	"heading" text NOT NULL,
	"paragraphs" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trainer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"trigger_type" text DEFAULT 'lead_created' NOT NULL,
	"trigger_source" "lead_source",
	"trigger_stage" "pipeline_stage",
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "scheduled_emails_lead_id_sequence_step_unique";--> statement-breakpoint
ALTER TABLE "scheduled_emails" ADD COLUMN "kind" text DEFAULT 'sequence' NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_emails" ADD COLUMN "step_id" uuid;--> statement-breakpoint
ALTER TABLE "scheduled_emails" ADD COLUMN "attempt" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "email_sequence_steps" ADD CONSTRAINT "email_sequence_steps_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sequence_steps" ADD CONSTRAINT "email_sequence_steps_sequence_id_email_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."email_sequences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sequences" ADD CONSTRAINT "email_sequences_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_sequence_steps_sequence_id_position_idx" ON "email_sequence_steps" USING btree ("sequence_id","position");--> statement-breakpoint
CREATE INDEX "email_sequences_trainer_id_idx" ON "email_sequences" USING btree ("trainer_id");--> statement-breakpoint
ALTER TABLE "scheduled_emails" ADD CONSTRAINT "scheduled_emails_step_id_email_sequence_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."email_sequence_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "scheduled_emails_lead_id_sequence_step_attempt_unique" ON "scheduled_emails" USING btree ("lead_id","sequence_step","attempt");