-- AlterTable
ALTER TABLE "appraisal_periods" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "department_configs" ALTER COLUMN "primary_weight" SET DEFAULT 0.5,
ALTER COLUMN "secondary_weight" SET DEFAULT 0.3,
ALTER COLUMN "tertiary_weight" SET DEFAULT 0.2;

-- AlterTable
ALTER TABLE "employee_line_manager_assignments" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "permissions" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "roles" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "user_department_assignments" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "cefr_expected" (
    "grade_key" TEXT NOT NULL,
    "competency_key" TEXT NOT NULL,
    "level" TEXT NOT NULL,

    CONSTRAINT "cefr_expected_pkey" PRIMARY KEY ("grade_key","competency_key")
);

-- CreateIndex
CREATE INDEX "cefr_expected_grade_key_idx" ON "cefr_expected"("grade_key");

-- CreateIndex
CREATE INDEX "cefr_expected_competency_key_idx" ON "cefr_expected"("competency_key");

-- CreateIndex
CREATE INDEX "domain_scores_domain_id_idx" ON "domain_scores"("domain_id");

-- RenameForeignKey
ALTER TABLE "comm_assessments" RENAME CONSTRAINT "comm_assessments_subject_id_fkey" TO "comm_assessments_employee_id_fkey";

-- AddForeignKey
ALTER TABLE "cefr_expected" ADD CONSTRAINT "cefr_expected_grade_key_fkey" FOREIGN KEY ("grade_key") REFERENCES "behav_grade"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "competency_domain_maps_department_id_competency_id_domain_id_ke" RENAME TO "competency_domain_maps_department_id_competency_id_domain_i_key";

-- RenameIndex
ALTER INDEX "competency_grade_thresholds_department_id_grade_id_competency_i" RENAME TO "competency_grade_thresholds_department_id_grade_id_competen_key";

-- RenameIndex
ALTER INDEX "employee_line_manager_assignments_manager_user_employee_rel_key" RENAME TO "employee_line_manager_assignments_manager_user_id_employee__key";

-- RenameIndex
ALTER INDEX "user_department_assignments_user_id_department_id_assignment_t_" RENAME TO "user_department_assignments_user_id_department_id_assignmen_key";

