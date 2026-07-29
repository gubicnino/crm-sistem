ALTER TABLE "email_sequence_steps" ALTER COLUMN "body" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "email_sequence_steps" DROP COLUMN "heading";--> statement-breakpoint
ALTER TABLE "email_sequence_steps" DROP COLUMN "paragraphs";