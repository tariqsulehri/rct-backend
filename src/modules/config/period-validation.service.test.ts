import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { assertActiveSubmissionWindow } from './period-validation.service';

describe('assertActiveSubmissionWindow', () => {
  const mockDb = {
    appraisalPeriod: {
      findMany: jest.fn<any>(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return active period when target date is inside start_date and end_date', async () => {
    const period = {
      id: 1,
      code: 'CY2026',
      name: '2026 Annual Review',
      start_date: new Date('2026-01-01T00:00:00.000Z'),
      end_date: new Date('2026-12-31T23:59:59.999Z'),
      grace_period_end: new Date('2027-01-15T23:59:59.999Z'),
      status: 'OPEN',
      is_active: true,
    };
    mockDb.appraisalPeriod.findMany.mockResolvedValue([period]);

    const result = await assertActiveSubmissionWindow(
      { targetDate: new Date('2026-06-15T12:00:00.000Z') },
      mockDb as any,
    );

    expect(result.id).toBe(1);
    expect(result.code).toBe('CY2026');
  });

  test('should block transaction with HTTP 403 when target date is outside start_date and end_date', async () => {
    const period = {
      id: 1,
      code: 'CY2026',
      name: '2026 Annual Review',
      start_date: new Date('2026-01-01T00:00:00.000Z'),
      end_date: new Date('2026-03-31T23:59:59.999Z'),
      grace_period_end: null,
      status: 'OPEN',
      is_active: true,
    };
    mockDb.appraisalPeriod.findMany.mockResolvedValue([period]);

    await expect(
      assertActiveSubmissionWindow(
        { targetDate: new Date('2026-04-05T12:00:00.000Z') },
        mockDb as any,
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'SUBMISSION_WINDOW_CLOSED',
    });
  });

  test('should allow manager review within grace_period_end window', async () => {
    const period = {
      id: 1,
      code: 'CY2026',
      name: '2026 Annual Review',
      start_date: new Date('2026-01-01T00:00:00.000Z'),
      end_date: new Date('2026-03-31T23:59:59.999Z'),
      grace_period_end: new Date('2026-04-15T23:59:59.999Z'),
      status: 'OPEN',
      is_active: true,
    };
    mockDb.appraisalPeriod.findMany.mockResolvedValue([period]);

    const result = await assertActiveSubmissionWindow(
      { targetDate: new Date('2026-04-05T12:00:00.000Z'), isManagerReview: true },
      mockDb as any,
    );

    expect(result.id).toBe(1);
  });

  test('should select valid period when 2 active periods overlap concurrently', async () => {
    const period1 = {
      id: 1,
      code: 'CY2026',
      name: '2026 Annual Review',
      start_date: new Date('2026-01-01T00:00:00.000Z'),
      end_date: new Date('2026-12-31T23:59:59.999Z'),
      grace_period_end: null,
      status: 'OPEN',
      is_active: true,
    };
    const period2 = {
      id: 2,
      code: 'FY2026-H1',
      name: '2026 Mid-Year Review',
      start_date: new Date('2026-06-01T00:00:00.000Z'),
      end_date: new Date('2026-07-31T23:59:59.999Z'),
      grace_period_end: null,
      status: 'OPEN',
      is_active: true,
    };
    mockDb.appraisalPeriod.findMany.mockResolvedValue([period2, period1]);

    const result = await assertActiveSubmissionWindow(
      { targetDate: new Date('2026-06-15T12:00:00.000Z') },
      mockDb as any,
    );

    expect(result).toBeDefined();
    expect([1, 2]).toContain(result.id);
  });
});
