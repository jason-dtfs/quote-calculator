ALTER TABLE "blanks" ADD COLUMN "priceXS" numeric(8, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "blanks" ADD COLUMN "price4XL" numeric(8, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "blanks" ADD COLUMN "price5XL" numeric(8, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
-- Carry forward existing values: priceXS = priceSXL, price4XL = price4XLPlus, price5XL = price4XLPlus
UPDATE "blanks" SET "priceXS" = "priceSXL", "price4XL" = "price4XLPlus", "price5XL" = "price4XLPlus";--> statement-breakpoint
ALTER TABLE "quote_items" ADD COLUMN "qtyXS" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_items" ADD COLUMN "qty5XL" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "blanks" DROP COLUMN "price4XLPlus";