-- AlterTable: Add appraisal_period_id to skill_assessments
ALTER TABLE "skill_assessments" ADD COLUMN "appraisal_period_id" INTEGER;

-- AlterTable: Add appraisal_period_id to comm_assessments
ALTER TABLE "comm_assessments" ADD COLUMN "appraisal_period_id" INTEGER;

-- CreateIndex
CREATE INDEX "skill_assessments_appraisal_period_id_idx" ON "skill_assessments"("appraisal_period_id");

-- CreateIndex
CREATE INDEX "comm_assessments_appraisal_period_id_idx" ON "comm_assessments"("appraisal_period_id");

-- AddForeignKey
ALTER TABLE "skill_assessments" ADD CONSTRAINT "skill_assessments_appraisal_period_id_fkey" FOREIGN KEY ("appraisal_period_id") REFERENCES "appraisal_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_assessments" ADD CONSTRAINT "comm_assessments_appraisal_period_id_fkey" FOREIGN KEY ("appraisal_period_id") REFERENCES "appraisal_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
