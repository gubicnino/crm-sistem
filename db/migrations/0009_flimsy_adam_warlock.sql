CREATE TABLE "email_broadcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trainer_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"body" jsonb NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"recipient_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scheduled_emails" ADD COLUMN "broadcast_id" uuid;--> statement-breakpoint
ALTER TABLE "email_broadcasts" ADD CONSTRAINT "email_broadcasts_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_emails" ADD CONSTRAINT "scheduled_emails_broadcast_id_email_broadcasts_id_fk" FOREIGN KEY ("broadcast_id") REFERENCES "public"."email_broadcasts"("id") ON DELETE set null ON UPDATE no action;