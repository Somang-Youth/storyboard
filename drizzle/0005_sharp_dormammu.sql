CREATE TABLE "discord_interaction_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"interaction_id" text NOT NULL,
	"interaction_type" integer NOT NULL,
	"processed_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discord_processed_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"message_id" text NOT NULL,
	"parse_status" text DEFAULT 'processed' NOT NULL,
	"raw_content" text,
	"processed_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discord_thread_states" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"sunday_date" text NOT NULL,
	"conti_id" text,
	"preacher" text,
	"leader" text,
	"worship_leader" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discord_thread_states" ADD CONSTRAINT "discord_thread_states_conti_id_contis_id_fk" FOREIGN KEY ("conti_id") REFERENCES "public"."contis"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "discord_interaction_receipts_interaction_id_unique" ON "discord_interaction_receipts" USING btree ("interaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "discord_processed_messages_message_id_unique" ON "discord_processed_messages" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "discord_thread_states_thread_id_unique" ON "discord_thread_states" USING btree ("thread_id");