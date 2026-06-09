-- Make competency grade thresholds department-specific.
-- Existing DevOps threshold data is attached to the DevOps department.

INSERT INTO "organizations" ("name", "slug", "logo_url", "base_url", "created_at", "updated_at")
VALUES ('tkxel', 'tkxel', '/assets/organizations/tkxel-logo.svg', 'https://tkxel.com', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE
SET "name" = EXCLUDED."name",
    "logo_url" = EXCLUDED."logo_url",
    "base_url" = EXCLUDED."base_url",
    "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "departments" ("organization_id", "name", "description", "created_at")
SELECT "id", 'DevOps', 'Default department for the current DevOps scoring data.', CURRENT_TIMESTAMP
FROM "organizations"
WHERE "slug" = 'tkxel'
ON CONFLICT ("organization_id", "name") DO UPDATE
SET "description" = COALESCE("departments"."description", EXCLUDED."description");

ALTER TABLE "competency_grade_thresholds" ADD COLUMN "department_id" INTEGER;

UPDATE "competency_grade_thresholds"
SET "department_id" = (
  SELECT d."id"
  FROM "departments" d
  JOIN "organizations" o ON o."id" = d."organization_id"
  WHERE o."slug" = 'tkxel' AND d."name" = 'DevOps'
  LIMIT 1
)
WHERE "department_id" IS NULL;

UPDATE "employees"
SET "department_id" = (
  SELECT d."id"
  FROM "departments" d
  JOIN "organizations" o ON o."id" = d."organization_id"
  WHERE o."slug" = 'tkxel' AND d."name" = 'DevOps'
  LIMIT 1
)
WHERE "department_id" IS NULL;

ALTER TABLE "competency_grade_thresholds" ALTER COLUMN "department_id" SET NOT NULL;

ALTER TABLE "competency_grade_thresholds"
DROP CONSTRAINT IF EXISTS "competency_grade_thresholds_grade_id_competency_id_key";
DROP INDEX IF EXISTS "competency_grade_thresholds_grade_id_competency_id_key";
CREATE INDEX "competency_grade_thresholds_department_id_idx" ON "competency_grade_thresholds"("department_id");
CREATE UNIQUE INDEX "competency_grade_thresholds_department_id_grade_id_competency_id_key" ON "competency_grade_thresholds"("department_id", "grade_id", "competency_id");

ALTER TABLE "competency_grade_thresholds"
ADD CONSTRAINT "competency_grade_thresholds_department_id_fkey"
FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
