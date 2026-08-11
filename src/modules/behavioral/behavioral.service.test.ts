import { describe, it, expect } from '@jest/globals';
import { createBehavioralAssessmentSchema } from './behavioral.schema';

describe('Behavioral Service & Schema Validation', () => {
  describe('Zod Schema Validation', () => {
    it('validates a complete valid create behavioral assessment request', () => {
      const payload = {
        body: {
          subjectId: 'EMP001',
          gradeKey: 'G15',
          ratings: [
            { competencyKey: 'ownership', level: 'L3', evidence: 'Led project release' },
            { competencyKey: 'collaboration', level: 'L4', evidence: 'Mentored peers' },
            { competencyKey: 'customer_business', level: 'L3' },
            { competencyKey: 'communication', level: 'L2' },
            { competencyKey: 'adaptability', level: 'L3' },
            { competencyKey: 'integrity', level: 'L4' },
          ],
        },
      };

      const parsed = createBehavioralAssessmentSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
    });

    it('rejects invalid level code in ratings', () => {
      const payload = {
        body: {
          subjectId: 'EMP001',
          gradeKey: 'G15',
          ratings: [{ competencyKey: 'ownership', level: 'INVALID' as any }],
        },
      };

      const parsed = createBehavioralAssessmentSchema.safeParse(payload);
      expect(parsed.success).toBe(false);
    });

    it('rejects empty ratings array', () => {
      const payload = {
        body: {
          subjectId: 'EMP001',
          gradeKey: 'G15',
          ratings: [],
        },
      };

      const parsed = createBehavioralAssessmentSchema.safeParse(payload);
      expect(parsed.success).toBe(false);
    });
  });
});
