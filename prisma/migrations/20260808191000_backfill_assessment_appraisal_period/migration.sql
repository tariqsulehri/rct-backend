-- Backfill NULL appraisal_period_id in comm_assessments using active appraisal period
UPDATE "comm_assessments"
SET "appraisal_period_id" = (
  SELECT id FROM "appraisal_periods"
  WHERE is_active = true AND status = 'OPEN'
  ORDER BY start_date DESC
  LIMIT 1
)
WHERE "appraisal_period_id" IS NULL;

-- Backfill NULL appraisal_period_id in skill_assessments using active appraisal period
UPDATE "skill_assessments"
SET "appraisal_period_id" = (
  SELECT id FROM "appraisal_periods"
  WHERE is_active = true AND status = 'OPEN'
  ORDER BY start_date DESC
  LIMIT 1
)
WHERE "appraisal_period_id" IS NULL;
