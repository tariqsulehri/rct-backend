-- Enforce one active line-manager assignment per employee and relationship type.
-- Keep the most recent primary assignment active when legacy duplicates exist.

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "employee_id", "relationship_type"
      ORDER BY "is_primary" DESC, "updated_at" DESC, "id" DESC
    ) AS rn
  FROM "employee_line_manager_assignments"
  WHERE "is_active" = true
)
UPDATE "employee_line_manager_assignments" assignment
SET
  "is_active" = false,
  "ends_at" = COALESCE(assignment."ends_at", CURRENT_TIMESTAMP),
  "updated_at" = CURRENT_TIMESTAMP
FROM ranked
WHERE assignment."id" = ranked."id"
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "employee_line_manager_assignments_one_active_employee_rel_idx"
  ON "employee_line_manager_assignments"("employee_id", "relationship_type")
  WHERE "is_active" = true;
