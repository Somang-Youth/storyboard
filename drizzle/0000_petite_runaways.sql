CREATE TABLE "conti_songs" (
	"id" text PRIMARY KEY NOT NULL,
	"conti_id" text NOT NULL,
	"song_id" text NOT NULL,
	"sort_order" integer NOT NULL,
	"keys" text,
	"tempos" text,
	"section_order" text,
	"lyrics" text,
	"section_lyrics_map" text,
	"notes" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contis" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text,
	"date" text NOT NULL,
	"description" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sheet_music_files" (
	"id" text PRIMARY KEY NOT NULL,
	"song_id" text NOT NULL,
	"file_url" text NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "song_presets" (
	"id" text PRIMARY KEY NOT NULL,
	"song_id" text NOT NULL,
	"name" text NOT NULL,
	"keys" text,
	"tempos" text,
	"section_order" text,
	"lyrics" text,
	"section_lyrics_map" text,
	"notes" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "songs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conti_songs" ADD CONSTRAINT "conti_songs_conti_id_contis_id_fk" FOREIGN KEY ("conti_id") REFERENCES "public"."contis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conti_songs" ADD CONSTRAINT "conti_songs_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet_music_files" ADD CONSTRAINT "sheet_music_files_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_presets" ADD CONSTRAINT "song_presets_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conti_song_unique" ON "conti_songs" USING btree ("conti_id","song_id");