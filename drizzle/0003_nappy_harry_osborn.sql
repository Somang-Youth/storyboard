CREATE TABLE "preset_sheet_music" (
	"id" text PRIMARY KEY NOT NULL,
	"preset_id" text NOT NULL,
	"sheet_music_file_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conti_songs" ADD COLUMN "sheet_music_file_ids" text;--> statement-breakpoint
ALTER TABLE "preset_sheet_music" ADD CONSTRAINT "preset_sheet_music_preset_id_song_presets_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."song_presets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preset_sheet_music" ADD CONSTRAINT "preset_sheet_music_sheet_music_file_id_sheet_music_files_id_fk" FOREIGN KEY ("sheet_music_file_id") REFERENCES "public"."sheet_music_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "preset_sheet_music_unique" ON "preset_sheet_music" USING btree ("preset_id","sheet_music_file_id");