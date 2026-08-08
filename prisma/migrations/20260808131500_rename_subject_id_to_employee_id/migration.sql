-- Rename column subject_id to employee_id in comm_assessments
ALTER TABLE "comm_assessments" RENAME COLUMN "subject_id" TO "employee_id";

-- Rename index
ALTER INDEX "comm_assessments_subject_id_idx" RENAME TO "comm_assessments_employee_id_idx";
