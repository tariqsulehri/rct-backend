import {
  approveSkillAssessmentSchema,
  createSkillAssessmentSchema,
  updateSkillAssessmentSchema,
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
});

