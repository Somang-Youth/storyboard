ALTER TABLE "conti_songs" ADD COLUMN "preset_id" text;--> statement-breakpoint
ALTER TABLE "song_presets" ADD COLUMN "pdf_metadata" text;--> statement-breakpoint
ALTER TABLE "conti_songs" ADD CONSTRAINT "conti_songs_preset_id_song_presets_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."song_presets"("id") ON DELETE set null ON UPDATE no action;