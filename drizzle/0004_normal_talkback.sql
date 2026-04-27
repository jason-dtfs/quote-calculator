ALTER TABLE "blanks" ADD COLUMN "sortOrder" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "print_presets" ADD COLUMN "sortOrder" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Backfill sortOrder by current display order so the first post-migration list
-- render matches what users saw before. blanks.list orders by brand, modelName;
-- printPresets.list orders by name. id is the final tiebreaker for determinism.
UPDATE "blanks" SET "sortOrder" = sub.rn - 1
  FROM (
    SELECT "id", ROW_NUMBER() OVER (
      PARTITION BY "userId"
      ORDER BY "brand", "modelName", "id"
    ) AS rn
    FROM "blanks"
  ) AS sub
  WHERE "blanks"."id" = sub."id";--> statement-breakpoint
UPDATE "print_presets" SET "sortOrder" = sub.rn - 1
  FROM (
    SELECT "id", ROW_NUMBER() OVER (
      PARTITION BY "userId"
      ORDER BY "name", "id"
    ) AS rn
    FROM "print_presets"
  ) AS sub
  WHERE "print_presets"."id" = sub."id";
