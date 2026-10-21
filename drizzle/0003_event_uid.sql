ALTER TABLE "event" ADD COLUMN "uid" text;--> statement-breakpoint
CREATE UNIQUE INDEX "event_source_uid_unique" ON "event" USING btree ("source","uid");