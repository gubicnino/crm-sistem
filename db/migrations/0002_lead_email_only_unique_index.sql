DROP INDEX "leads_trainer_id_email_source_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "leads_trainer_id_email_unique" ON "leads" USING btree ("trainer_id","email");