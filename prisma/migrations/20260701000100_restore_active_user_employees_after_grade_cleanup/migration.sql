-- The previous grade cleanup archived employees that referenced copied
-- non-DevOps grade rows. Active login users must remain usable after their
-- grade references are remapped, otherwise valid accounts are rejected at login.

UPDATE "employees" e
SET "deleted_at" = NULL
FROM "users" u
WHERE u."employee_id" = e."id"
  AND u."is_active" = TRUE
  AND e."deleted_at" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "departments" employee_department
    WHERE employee_department."id" = e."department_id"
      AND employee_department."name" <> 'DevOps'
  )
  AND (
    EXISTS (
      SELECT 1
      FROM "grades" current_grade
      JOIN "departments" current_grade_department
        ON current_grade_department."id" = current_grade."department_id"
      WHERE current_grade."id" = e."current_grade_id"
        AND current_grade_department."name" = 'DevOps'
    )
    OR EXISTS (
      SELECT 1
      FROM "grades" target_grade
      JOIN "departments" target_grade_department
        ON target_grade_department."id" = target_grade."department_id"
      WHERE target_grade."id" = e."target_grade_id"
        AND target_grade_department."name" = 'DevOps'
    )
  );
