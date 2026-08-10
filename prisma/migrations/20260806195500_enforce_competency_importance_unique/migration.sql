-- Clean up duplicate skill assessments keeping the latest record (highest id)
DELETE FROM "skill_assessments"
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY employee_id, competency_id, type
             ORDER BY id DESC
           ) as rnum
    FROM "skill_assessments"
  ) t
  WHERE t.rnum > 1
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "skill_assessments_employee_id_competency_id_type_key" ON "skill_assessments"("employee_id", "competency_id", "type");


