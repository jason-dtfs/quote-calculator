ALTER TABLE "blanks" ADD COLUMN "overridesSystemId" text;--> statement-breakpoint
ALTER TABLE "blanks" ADD COLUMN "isHidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "print_presets" ADD COLUMN "overridesSystemId" text;--> statement-breakpoint
ALTER TABLE "print_presets" ADD COLUMN "isHidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "blanks_user_override_idx" ON "blanks" USING btree ("userId","overridesSystemId");--> statement-breakpoint
CREATE INDEX "print_presets_user_override_idx" ON "print_presets" USING btree ("userId","overridesSystemId");