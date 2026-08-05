import { describe, it, expect } from '@jest/globals';
import {
  bulkUpsertDomainWeightsSchema,
  createUserSchema,
  upsertDepartmentConfigSchema,
  createAppraisalPeriodSchema,
  updateAppraisalPeriodSchema,
} from './config.schema';

describe('config schemas', () => {
  it('accepts valid user creation payloads', () => {
    const result = createUserSchema.safeParse({
      username: 'engineer1',
      password: 'password123',
      role: 'ENGINEER',
      employee_id: 1,
    });

    expect(result.success).toBe(true);
  });

  it('rejects unsupported user roles', () => {
    const result = createUserSchema.safeParse({
      username: 'contractor1',
      password: 'password123',
      role: 'CONTRACTOR',
      employee_id: 1,
    });

    expect(result.success).toBe(false);
  });

  it('accepts department scoring values in range', () => {
    const result = upsertDepartmentConfigSchema.safeParse({
      primary_weight: 0.25,
      secondary_weight: 0.15,
      tertiary_weight: 0.10,
      notes: 'Default scoring values',
    });

    expect(result.success).toBe(true);
  });

  it('rejects department scoring values outside range', () => {
    const result = upsertDepartmentConfigSchema.safeParse({
      primary_weight: 1.2,
      secondary_weight: 0.3,
      tertiary_weight: 0.2,
    });

    expect(result.success).toBe(false);
  });

  it('accepts bulk domain weight payloads', () => {
    const result = bulkUpsertDomainWeightsSchema.safeParse({
      weights: [
        { domain_id: 1, weight: 0.5, is_active: true },
        { domain_id: 2, weight: 0.5, is_active: true },
      ],
    });

    expect(result.success).toBe(true);
  });

  describe('appraisal period schemas', () => {
    it('accepts valid appraisal period creation payloads', () => {
      const result = createAppraisalPeriodSchema.safeParse({
        code: 'CY2026',
        name: '2026 Annual Career Evaluation',
        period_type: 'ANNUAL',
        calendar_year: 2026,
        start_date: '2026-01-01T00:00:00Z',
        end_date: '2026-10-31T23:59:59Z',
        status: 'OPEN',
        is_active: true,
        allow_self_submission: true,
        auto_rollover_skills: true,
      });

      expect(result.success).toBe(true);
    });

    it('rejects invalid status or invalid year', () => {
      const result = createAppraisalPeriodSchema.safeParse({
        code: 'CY2026',
        name: '2026 Annual Career Evaluation',
        calendar_year: 1990, // below 2000
        start_date: '2026-01-01',
        end_date: '2026-10-31',
        status: 'INVALID_STATUS',
      });

      expect(result.success).toBe(false);
    });

    it('accepts partial update payloads', () => {
      const result = updateAppraisalPeriodSchema.safeParse({
        status: 'LOCKED',
        is_active: false,
      });

      expect(result.success).toBe(true);
    });
  });
});

