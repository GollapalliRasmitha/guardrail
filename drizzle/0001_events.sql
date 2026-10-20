CREATE TABLE "event" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"type" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" "inet",
	"ip_hash" text,
	"country" text,
	"actor" text,
	"path" text,
	"method" text,
	"status_code" integer,
	"user_agent" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest_nonce" (
	"source" text NOT NULL,
	"nonce" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingest_nonce_source_nonce_pk" PRIMARY KEY("source","nonce")
);
--> statement-breakpoint
CREATE INDEX "event_source_time_idx" ON "event" USING btree ("source","occurred_at");--> statement-breakpoint
CREATE INDEX "event_type_time_idx" ON "event" USING btree ("type","occurred_at");--> statement-breakpoint
CREATE INDEX "event_ip_hash_time_idx" ON "event" USING btree ("ip_hash","occurred_at");--> statement-breakpoint
CREATE INDEX "event_received_idx" ON "event" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "ingest_nonce_time_idx" ON "ingest_nonce" USING btree ("source","created_at");