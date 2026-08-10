-- Clean up duplicate skill assessments keeping the latest record (highest id)
DELETE FROM "skill_assessments" a
USING "skill_assessments" b
WHERE a.employee_id = b.employee_id
  AND a.competency_id = b.competency_id
  AND a.type = b.type
  AND a.id < b.id;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "skill_assessments_employee_id_competency_id_type_key" ON "skill_assessments"("employee_id", "competency_id", "type");

