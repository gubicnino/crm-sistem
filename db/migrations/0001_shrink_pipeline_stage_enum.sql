ALTER TABLE "leads" ALTER COLUMN "stage" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."pipeline_stage";--> statement-breakpoint
CREATE TYPE "public"."pipeline_stage" AS ENUM('email_lead', 'application_received', 'contacted', 'client', 'lost');--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "stage" SET DATA TYPE "public"."pipeline_stage" USING "stage"::"public"."pipeline_stage";