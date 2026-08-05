-- CreateTable
CREATE TABLE "appraisal_periods" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "period_type" TEXT NOT NULL DEFAULT 'ANNUAL',
    "calendar_year" INTEGER NOT NULL DEFAULT 2026,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "grace_period_end" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "allow_self_submission" BOOLEAN NOT NULL DEFAULT true,
    "auto_rollover_skills" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appraisal_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "appraisal_periods_code_key" ON "appraisal_periods"("code");

-- CreateIndex
CREATE INDEX "appraisal_periods_calendar_year_idx" ON "appraisal_periods"("calendar_year");

-- CreateIndex
CREATE INDEX "appraisal_periods_status_idx" ON "appraisal_periods"("status");

-- CreateIndex
CREATE INDEX "appraisal_periods_is_active_idx" ON "appraisal_periods"("is_active");
