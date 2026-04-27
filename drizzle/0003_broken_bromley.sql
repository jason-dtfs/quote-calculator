ALTER TABLE "blanks" ADD COLUMN "isOneSize" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "blanks" ADD COLUMN "priceOS" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "quote_items" ADD COLUMN "qtyOS" integer DEFAULT 0 NOT NULL;