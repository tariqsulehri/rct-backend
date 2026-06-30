ALTER TABLE "grades" ADD COLUMN "department_id" INTEGER;

UPDATE "grades"
SET "department_id" = (
  SELECT d."id"
  FROM "departments" d
  JOIN "organizations" o ON o."id" = d."organization_id"
  WHERE o."slug" = 'tkxel' AND d."name" = 'DevOps'
  LIMIT 1
)
WHERE "department_id" IS NULL;

DROP INDEX IF EXISTS "grades_code_key";

INSERT INTO "grades" ("department_id", "code", "title", "level", "experience_years", "performance_note")
SELECT d."id", g."code", g."title", g."level", g."experience_years", g."performance_note"
FROM "departments" d
CROSS JOIN "grades" g
WHERE g."department_id" = (
  SELECT d2."id"
  FROM "departments" d2
  JOIN "organizations" o2 ON o2."id" = d2."organization_id"
  WHERE o2."slug" = 'tkxel' AND d2."name" = 'DevOps'
  LIMIT 1
)
AND d."id" <> g."department_id"
AND NOT EXISTS (
  SELECT 1
  FROM "grades" existing
  WHERE existing."department_id" = d."id"
    AND existing."code" = g."code"
);

UPDATE "employees" e
SET "current_grade_id" = scoped."id"
FROM "grades" current_grade
JOIN "grades" scoped
  ON scoped."code" = current_grade."code"
WHERE current_grade."id" = e."current_grade_id"
  AND scoped."department_id" = e."department_id";

UPDATE "employees" e
SET "target_grade_id" = scoped."id"
FROM "grades" target_grade
JOIN "grades" scoped
  ON scoped."code" = target_grade."code"
WHERE target_grade."id" = e."target_grade_id"
  AND scoped."department_id" = e."department_id";

ALTER TABLE "grades" ALTER COLUMN "department_id" SET NOT NULL;

CREATE UNIQUE INDEX "grades_department_id_code_key" ON "grades"("department_id", "code");
CREATE INDEX "grades_department_id_idx" ON "grades"("department_id");

ALTER TABLE "grades"
ADD CONSTRAINT "grades_department_id_fkey"
FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
