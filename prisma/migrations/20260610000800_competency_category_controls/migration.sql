-- Prepare competency categories to act as company-wide assessment segments.
-- Existing rows stay active and keep neutral weight until scoring formally uses
-- category weights.

ALTER TABLE "competency_categories"
  ADD COLUMN IF NOT EXISTS "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;

WITH ordered_categories AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "id") AS rn
  FROM "competency_categories"
)
UPDATE "competency_categories" category
SET "sort_order" = ordered_categories.rn
FROM ordered_categories
WHERE category."id" = ordered_categories."id"
  AND category."sort_order" = 0;

CREATE INDEX IF NOT EXISTS "competency_categories_is_active_idx"
  ON "competency_categories"("is_active");

CREATE INDEX IF NOT EXISTS "competency_categories_sort_order_idx"
  ON "competency_categories"("sort_order");
