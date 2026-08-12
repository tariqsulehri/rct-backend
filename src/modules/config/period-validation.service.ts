import { db } from '../../config/database';

export interface ActivePeriodValidationOptions {
  isManagerReview?: boolean;
  targetDate?: Date;
}

export interface AppraisalPeriodRecord {
  id: number;
  code: string;
  name: string;
  start_date: Date;
  end_date: Date;
  grace_period_end: Date | null;
  status: string;
  is_active: boolean;
}

/**
 * Validates that current timestamp (or targetDate) falls strictly between start_date and end_date
 * (or grace_period_end for manager review) for an active, open fiscal appraisal period.
 *
 * If no active appraisal period covers the target date window, or if period is LOCKED/ARCHIVED/DRAFT,
 * throws a structured HTTP 403 error and BLOCKS database save.
 */
export async function assertActiveSubmissionWindow(
  options: ActivePeriodValidationOptions = {},
  customDb: any = db,
): Promise<AppraisalPeriodRecord> {
  const checkDate = options.targetDate ?? new Date();
  const isManager = options.isManagerReview ?? false;

  // Find all active & open appraisal periods
  const activePeriods = await customDb.appraisalPeriod.findMany({
    where: {
      is_active: true,
      status: 'OPEN',
    },
    orderBy: [
      { start_date: 'desc' },
      { id: 'desc' },
    ],
  });

  if (activePeriods.length === 0) {
    const error = new Error('Assessment submission blocked: No active evaluation period is currently open for submissions.');
    throw Object.assign(error, { statusCode: 403, code: 'NO_ACTIVE_PERIOD' });
  }

  // Filter periods where checkDate is between start_date and end_date (or grace_period_end for manager)
  const validPeriod = activePeriods.find((period: AppraisalPeriodRecord) => {
    const startDate = new Date(period.start_date);
    const endDateBoundary = isManager && period.grace_period_end
      ? new Date(period.grace_period_end)
      : new Date(period.end_date);

    return checkDate >= startDate && checkDate <= endDateBoundary;
  });

  if (!validPeriod) {
    const windowSummaries = activePeriods.map((p: AppraisalPeriodRecord) => {
      const start = new Date(p.start_date).toISOString().split('T')[0];
      const end = new Date(p.end_date).toISOString().split('T')[0];
      return `'${p.code}' (${start} to ${end})`;
    }).join(', ');

    const dateStr = checkDate.toISOString().split('T')[0];
    const error = new Error(
      `Assessment submission window is closed. Target date (${dateStr}) is outside the active submission date window for active fiscal period(s): ${windowSummaries}.`
    );
    throw Object.assign(error, { statusCode: 403, code: 'SUBMISSION_WINDOW_CLOSED' });
  }

  return validPeriod;
}
