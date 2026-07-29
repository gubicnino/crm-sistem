ALTER TABLE "email_sequence_steps" ALTER COLUMN "heading" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "email_sequence_steps" ALTER COLUMN "paragraphs" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "email_sequence_steps" ADD COLUMN "body" jsonb;