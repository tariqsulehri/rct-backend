import { describe, it, expect } from '@jest/globals';
import {
  approveSkillAssessmentSchema,
  createSkillAssessmentSchema,
  updateSkillAssessmentSchema,
  submitDraftsSchema,
} from './assessment.schema';

describe('assessment schemas', () => {
  it('accepts a valid skill assessment payload', () => {
    const result = createSkillAssessmentSchema.safeParse({
      employee_id: '1818',
      technology_id: 1,
      type: 'Primary',
      projects: 3,
      level: 'Expert',
    });

    expect(result.success).toBe(true);
  });

  it('defaults assessment level to Unset when omitted', () => {
    const result = createSkillAssessmentSchema.parse({
      employee_id: '1818',
      technology_id: 1,
      type: 'Secondary',
      projects: 2,
    });

    expect(result.level).toBe('Unset');
  });

  it('rejects projects outside the allowed 0 to 3 range', () => {
    const result = createSkillAssessmentSchema.safeParse({
      employee_id: '1818',
      technology_id: 1,
      type: 'Primary',
      projects: 4,
      level: 'Expert',
    });

    expect(result.success).toBe(false);
  });

  it('allows partial update payloads', () => {
    const result = updateSkillAssessmentSchema.safeParse({
      projects: 1,
    });

    expect(result.success).toBe(true);
  });

  it('allows partial approval payloads', () => {
    const result = approveSkillAssessmentSchema.safeParse({
      level: 'Proficient',
    });

    expect(result.success).toBe(true);
  });

  it('accepts valid status values in create and update schemas', () => {
    const draftCreate = createSkillAssessmentSchema.safeParse({
      employee_id: '1818',
      technology_id: 1,
      type: 'Primary',
      projects: 2,
      status: 'draft',
    });
    expect(draftCreate.success).toBe(true);

    const updateStatus = updateSkillAssessmentSchema.safeParse({
      status: 'pending',
    });
    expect(updateStatus.success).toBe(true);
  });

  it('validates submitDraftsSchema', () => {
    const emptySubmit = submitDraftsSchema.safeParse({});
    expect(emptySubmit.success).toBe(true);

    const specificIdsSubmit = submitDraftsSchema.safeParse({
      assessment_ids: [1, 2, 3],
    });
    expect(specificIdsSubmit.success).toBe(true);
  });
});

