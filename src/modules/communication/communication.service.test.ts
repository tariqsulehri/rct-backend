import { describe, it, expect } from '@jest/globals';
import { gradeLevelToOrgLevelKey, communicationService } from './communication.service';
import {
  createCommAssessmentSchema,
  updateCommAssessmentStatusSchema,
} from './communication.schema';

describe('Communication Service & Schema', () => {
  describe('Grade Level to Org Level Mapping', () => {
    it('maps level 1 through 9 to exact org level keys', () => {
      expect(gradeLevelToOrgLevelKey(1)).toBe('associate');
      expect(gradeLevelToOrgLevelKey(2)).toBe('engineer');
      expect(gradeLevelToOrgLevelKey(3)).toBe('senior');
      expect(gradeLevelToOrgLevelKey(4)).toBe('lead');
      expect(gradeLevelToOrgLevelKey(5)).toBe('manager');
      expect(gradeLevelToOrgLevelKey(6)).toBe('senior_mgr');
      expect(gradeLevelToOrgLevelKey(7)).toBe('director');
      expect(gradeLevelToOrgLevelKey(8)).toBe('vp');
      expect(gradeLevelToOrgLevelKey(9)).toBe('c_level');
      expect(gradeLevelToOrgLevelKey(10)).toBe('c_level');
    });
  });

  describe('Configuration Service', () => {
    it('returns valid CEFR configuration', () => {
      const config = communicationService.getCommConfig();
      expect(config).toBeDefined();
      expect(Object.keys(config.cefrLevels)).toHaveLength(6);
      expect(config.competencies).toHaveLength(6);
    });
  });

  describe('Zod Schema Validation', () => {
    it('validates a complete valid create assessment request', () => {
      const payload = {
        employee_id: '101',
        org_level_key: 'senior',
        status: 'approved',
        ratings: [
          { competency_key: 'written_clarity', cefr: 'B2', evidence: 'Great RFCs' },
          { competency_key: 'spoken_fluency', cefr: 'B2' },
          { competency_key: 'presentation', cefr: 'B1' },
          { competency_key: 'active_listening', cefr: 'B2' },
          { competency_key: 'stakeholder_exec', cefr: 'B1' },
          { competency_key: 'cross_cultural', cefr: 'B2' },
        ],
      };

      const parsed = createCommAssessmentSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
    });

    it('rejects invalid CEFR level code in ratings', () => {
      const payload = {
        employee_id: '101',
        ratings: [{ competency_key: 'written_clarity', cefr: 'X9' }],
      };

      const parsed = createCommAssessmentSchema.safeParse(payload);
      expect(parsed.success).toBe(false);
    });

    it('rejects invalid competency key in ratings', () => {
      const payload = {
        employee_id: '101',
        ratings: [{ competency_key: 'invalid_skill', cefr: 'B2' }],
      };

      const parsed = createCommAssessmentSchema.safeParse(payload);
      expect(parsed.success).toBe(false);
    });

    it('validates status update payload', () => {
      const payload = {
        status: 'approved',
        ratings: [{ competency_key: 'presentation', cefr: 'B2' }],
      };

      const parsed = updateCommAssessmentStatusSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
    });
  });

  describe('Evaluation Formatting Helper', () => {
    it('formats raw engine evaluation into a complete response structure', () => {
      const service = communicationService as any;
      const rawEval = {
        overallWeight: 0.67,
        overallCefr: 'B2',
        overallExpectedWeight: 0.67,
        overallGap: 0,
        overallStatus: 'MEETS',
        perCompetency: [],
        complete: true,
        isGated: true,
        communicationReady: true,
        developmentPriority: [],
      };

      const formatted = service.formatEvaluation({ default: 'B2' }, 3, rawEval);
      expect(formatted.overallScore).toBe(0.67);
      expect(formatted.expectedScore).toBe(0.67);
      expect(formatted.expectedCefr).toBe('B2');
      expect(formatted.isComplete).toBe(true);
      expect(formatted.isPromotionGated).toBe(true);
      expect(formatted.developmentPriorities).toEqual([]);
    });
  });
});
