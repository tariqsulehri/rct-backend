-- CreateIndex
CREATE UNIQUE INDEX "skill_assessments_employee_id_competency_id_type_key" ON "skill_assessments"("employee_id", "competency_id", "type");
