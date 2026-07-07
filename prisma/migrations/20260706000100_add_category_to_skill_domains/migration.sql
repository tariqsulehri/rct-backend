-- Skill Areas now belong to the same category taxonomy used by Skills.
-- Existing Skill Areas are treated as Technical until changed in Config.

INSERT INTO "competency_categories" ("name", "description", "color", "weight", "sort_order", "is_active")
SELECT
  'Technical',
  'Hands-on technical skills and tool proficiency',
  '#3B82F6',
  1.0,
  COALESCE((SELECT MAX("sort_order") + 1 FROM "competency_categories"), 1),
  true
WHERE NOT EXISTS (
  SELECT 1 FROM "competency_categories" WHERE "name" = 'Technical'
);

ALTER TABLE "skill_domains"
  ADD COLUMN "category_id" INTEGER;

UPDATE "skill_domains"
SET "category_id" = (
  SELECT "id"
  FROM "competency_categories"
  WHERE "name" = 'Technical'
  ORDER BY "id"
  LIMIT 1
)
WHERE "category_id" IS NULL;

ALTER TABLE "skill_domains"
  ALTER COLUMN "category_id" SET NOT NULL;

CREATE INDEX "skill_domains_category_id_idx" ON "skill_domains"("category_id");

ALTER TABLE "skill_domains"
  ADD CONSTRAINT "skill_domains_category_id_fkey"
  FOREIGN KEY ("category_id")
  REFERENCES "competency_categories"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
