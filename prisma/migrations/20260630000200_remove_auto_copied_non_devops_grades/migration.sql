-- DevOps grades came from the source workbook. Other departments should define
-- their own grades manually instead of inheriting DevOps grade titles.
--
-- For rows that were already copied into non-DevOps departments, archive any
-- employees that reference those copied rows and remap their grade references
-- back to the matching DevOps grade so the copied rows can be removed.

UPDATE "employees" e
SET
  "current_grade_id" = devops_grade."id",
  "deleted_at" = COALESCE(e."deleted_at", NOW())
FROM "grades" copied_grade
JOIN "departments" copied_department ON copied_department."id" = copied_grade."department_id"
JOIN "departments" devops_department
  ON devops_department."organization_id" = copied_department."organization_id"
  AND devops_department."name" = 'DevOps'
JOIN "grades" devops_grade
  ON devops_grade."department_id" = devops_department."id"
  AND devops_grade."code" = copied_grade."code"
  AND devops_grade."title" = copied_grade."title"
  AND devops_grade."level" = copied_grade."level"
  AND devops_grade."experience_years" = copied_grade."experience_years"
  AND COALESCE(devops_grade."performance_note", '') = COALESCE(copied_grade."performance_note", '')
WHERE e."current_grade_id" = copied_grade."id"
  AND copied_department."name" <> 'DevOps';

UPDATE "employees" e
SET
  "target_grade_id" = devops_grade."id",
  "deleted_at" = COALESCE(e."deleted_at", NOW())
FROM "grades" copied_grade
JOIN "departments" copied_department ON copied_department."id" = copied_grade."department_id"
JOIN "departments" devops_department
  ON devops_department."organization_id" = copied_department."organization_id"
  AND devops_department."name" = 'DevOps'
JOIN "grades" devops_grade
  ON devops_grade."department_id" = devops_department."id"
  AND devops_grade."code" = copied_grade."code"
  AND devops_grade."title" = copied_grade."title"
  AND devops_grade."level" = copied_grade."level"
  AND devops_grade."experience_years" = copied_grade."experience_years"
  AND COALESCE(devops_grade."performance_note", '') = COALESCE(copied_grade."performance_note", '')
WHERE e."target_grade_id" = copied_grade."id"
  AND copied_department."name" <> 'DevOps';

DELETE FROM "grades" copied_grade
USING "departments" copied_department, "departments" devops_department, "grades" devops_grade
WHERE copied_department."id" = copied_grade."department_id"
  AND copied_department."name" <> 'DevOps'
  AND devops_department."organization_id" = copied_department."organization_id"
  AND devops_department."name" = 'DevOps'
  AND devops_grade."department_id" = devops_department."id"
  AND devops_grade."code" = copied_grade."code"
  AND devops_grade."title" = copied_grade."title"
  AND devops_grade."level" = copied_grade."level"
  AND devops_grade."experience_years" = copied_grade."experience_years"
  AND COALESCE(devops_grade."performance_note", '') = COALESCE(copied_grade."performance_note", '')
  AND NOT EXISTS (
    SELECT 1
    FROM "employees" e
    WHERE e."current_grade_id" = copied_grade."id"
      OR e."target_grade_id" = copied_grade."id"
  );
