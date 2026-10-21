CREATE TABLE "alert" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"rule_id" text NOT NULL,
	"group_key" text NOT NULL,
	"source" text NOT NULL,
	"severity" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"title" text NOT NULL,
	"subject" text NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL,
	"first_seen" timestamp with time zone NOT NULL,
	"last_seen" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"emailed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_activity" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"alert_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_event" (
	"alert_id" bigint NOT NULL,
	"event_id" bigint NOT NULL,
	CONSTRAINT "alert_event_alert_id_event_id_pk" PRIMARY KEY("alert_id","event_id")
);
--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "actor_id" text;--> statement-breakpoint
ALTER TABLE "alert_activity" ADD CONSTRAINT "alert_activity_alert_id_alert_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alert"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_event" ADD CONSTRAINT "alert_event_alert_id_alert_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alert"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_event" ADD CONSTRAINT "alert_event_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "alert_one_active_per_group" ON "alert" USING btree ("group_key") WHERE "alert"."status" <> 'resolved';--> statement-breakpoint
CREATE INDEX "alert_group_idx" ON "alert" USING btree ("group_key","resolved_at");--> statement-breakpoint
CREATE INDEX "alert_list_idx" ON "alert" USING btree ("status","severity","last_seen");--> statement-breakpoint
CREATE INDEX "alert_activity_alert_idx" ON "alert_activity" USING btree ("alert_id","created_at");--> statement-breakpoint
CREATE INDEX "alert_activity_kind_idx" ON "alert_activity" USING btree ("kind","created_at");--> statement-breakpoint
CREATE INDEX "alert_event_event_idx" ON "alert_event" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_actor_time_idx" ON "event" USING btree ("actor_id","occurred_at");