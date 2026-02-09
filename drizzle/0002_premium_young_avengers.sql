CREATE TABLE "song_page_images" (
	"id" text PRIMARY KEY NOT NULL,
	"song_id" text NOT NULL,
	"conti_id" text NOT NULL,
	"image_url" text NOT NULL,
	"page_index" integer NOT NULL,
	"sheet_music_file_id" text,
	"pdf_page_index" integer,
	"preset_snapshot" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "song_page_images" ADD CONSTRAINT "song_page_images_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_page_images" ADD CONSTRAINT "song_page_images_conti_id_contis_id_fk" FOREIGN KEY ("conti_id") REFERENCES "public"."contis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_page_images" ADD CONSTRAINT "song_page_images_sheet_music_file_id_sheet_music_files_id_fk" FOREIGN KEY ("sheet_music_file_id") REFERENCES "public"."sheet_music_files"("id") ON DELETE set null ON UPDATE no action;