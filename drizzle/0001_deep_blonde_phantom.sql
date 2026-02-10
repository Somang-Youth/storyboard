CREATE TABLE "conti_pdf_exports" (
	"id" text PRIMARY KEY NOT NULL,
	"conti_id" text NOT NULL,
	"pdf_url" text,
	"layout_state" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conti_pdf_exports" ADD CONSTRAINT "conti_pdf_exports_conti_id_contis_id_fk" FOREIGN KEY ("conti_id") REFERENCES "public"."contis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conti_pdf_export_unique" ON "conti_pdf_exports" USING btree ("conti_id");