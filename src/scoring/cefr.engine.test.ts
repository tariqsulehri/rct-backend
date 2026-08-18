import { describe, it, expect } from '@jest/globals';
import { assess, roundHalfUp, bandOf, statusOf, RatingInput } from './cefr.engine';
import { DEFAULT_CEFR_CONFIG, CefrLevelCode } from './cefr.config';

const SENIOR_EXPECTED: Record<string, CefrLevelCode> = { default: 'B2' };
const ASSOCIATE_EXPECTED: Record<string, CefrLevelCode> = { default: 'B1', presentation: 'A2', stakeholder_exec: 'A2' };
const VP_EXPECTED: Record<string, CefrLevelCode> = { default: 'C2' };
const MANAGER_EXPECTED: Record<string, CefrLevelCode> = { default: 'C1' };

describe('CEFR Communication Rule Engine', () => {
  describe('Helper functions & math determinism', () => {
    it('implements half-up rounding with floating-point drift safety', () => {
      expect(roundHalfUp(0.6133333333333333, 2)).toBe(0.61);
      expect(roundHalfUp(0.615, 2)).toBe(0.62);
      expect(roundHalfUp(-0.06000000000000005, 2)).toBe(-0.06);
      expect(roundHalfUp(-0.165, 2)).toBe(-0.17);
    });

    it('maps weights to CEFR bands using midpoint thresholds', () => {
      expect(bandOf(0.17)).toBe('A1');
      expect(bandOf(0.24)).toBe('A1');
      expect(bandOf(0.25)).toBe('A2');
      expect(bandOf(0.33)).toBe('A2');
      expect(bandOf(0.414)).toBe('A2');
      expect(bandOf(0.415)).toBe('B1');
      expect(bandOf(0.50)).toBe('B1');
      expect(bandOf(0.584)).toBe('B1');
      expect(bandOf(0.585)).toBe('B2');
      expect(bandOf(0.61)).toBe('B2');
      expect(bandOf(0.67)).toBe('B2');
      expect(bandOf(0.749)).toBe('B2');
      expect(bandOf(0.75)).toBe('C1');
      expect(bandOf(0.83)).toBe('C1');
      expect(bandOf(0.914)).toBe('C1');
      expect(bandOf(0.915)).toBe('C2');
      expect(bandOf(1.00)).toBe('C2');
    });



    it('maps numerical gaps to status strings', () => {
      expect(statusOf(-0.17)).toBe('BELOW');
      expect(statusOf(0.00)).toBe('MEETS');
      expect(statusOf(0.17)).toBe('ABOVE');
    });
  });

  describe('Canonical Test Vectors (§9 of Specification)', () => {
    it('TV1 — Senior, mixed: reproduces exact values', () => {
      const ratings: RatingInput[] = [
        { competencyKey: 'written_clarity', cefr: 'B2' },
        { competencyKey: 'spoken_fluency', cefr: 'B2' },
        { competencyKey: 'presentation', cefr: 'B1' },
        { competencyKey: 'active_listening', cefr: 'B2' },
        { competencyKey: 'stakeholder_exec', cefr: 'B1' },
        { competencyKey: 'cross_cultural', cefr: 'B2' },
      ];

      const result = assess(DEFAULT_CEFR_CONFIG, SENIOR_EXPECTED, 3, ratings);

      expect(result.overallWeight).toBe(0.61);
      expect(result.overallCefr).toBe('B2');
      expect(result.overallExpectedWeight).toBe(0.67);
      expect(result.overallGap).toBe(-0.06);
      expect(result.overallStatus).toBe('BELOW');
      expect(result.isGated).toBe(true);
      expect(result.communicationReady).toBe(false);
      expect(result.complete).toBe(true);
      expect(result.developmentPriority).toEqual(['presentation', 'stakeholder_exec']);

      const presentation = result.perCompetency.find((c) => c.competencyKey === 'presentation');
      expect(presentation?.gap).toBe(-0.17);
      expect(presentation?.status).toBe('BELOW');

      const stakeholder = result.perCompetency.find((c) => c.competencyKey === 'stakeholder_exec');
      expect(stakeholder?.gap).toBe(-0.17);
      expect(stakeholder?.status).toBe('BELOW');

      const written = result.perCompetency.find((c) => c.competencyKey === 'written_clarity');
      expect(written?.gap).toBe(0.00);
      expect(written?.status).toBe('MEETS');
    });

    it('TV2 — Associate, uniform B1: accounts for overrides and ungated promotion', () => {
      const ratings: RatingInput[] = [
        { competencyKey: 'written_clarity', cefr: 'B1' },
        { competencyKey: 'spoken_fluency', cefr: 'B1' },
        { competencyKey: 'presentation', cefr: 'B1' },
        { competencyKey: 'active_listening', cefr: 'B1' },
        { competencyKey: 'stakeholder_exec', cefr: 'B1' },
        { competencyKey: 'cross_cultural', cefr: 'B1' },
      ];

      const result = assess(DEFAULT_CEFR_CONFIG, ASSOCIATE_EXPECTED, 1, ratings);

      expect(result.overallWeight).toBe(0.50);
      expect(result.overallCefr).toBe('B1');
      expect(result.overallExpectedWeight).toBe(0.50);
      expect(result.overallGap).toBe(0.00);
      expect(result.overallStatus).toBe('MEETS');
      expect(result.isGated).toBe(false);
      expect(result.communicationReady).toBe(true);
      expect(result.developmentPriority).toEqual([]);
      expect(result.complete).toBe(true);

      const presentation = result.perCompetency.find((c) => c.competencyKey === 'presentation');
      expect(presentation?.expectedCefr).toBe('A2');
      expect(presentation?.gap).toBe(0.17);
      expect(presentation?.status).toBe('ABOVE');

      const stakeholder = result.perCompetency.find((c) => c.competencyKey === 'stakeholder_exec');
      expect(stakeholder?.expectedCefr).toBe('A2');
      expect(stakeholder?.gap).toBe(0.17);
      expect(stakeholder?.status).toBe('ABOVE');

      const written = result.perCompetency.find((c) => c.competencyKey === 'written_clarity');
      expect(written?.expectedCefr).toBe('B1');
      expect(written?.gap).toBe(0.00);
      expect(written?.status).toBe('MEETS');
    });

    it('TV3 — VP, uniform C1: below C2 benchmark, gated and not ready', () => {
      const ratings: RatingInput[] = [
        { competencyKey: 'written_clarity', cefr: 'C1' },
        { competencyKey: 'spoken_fluency', cefr: 'C1' },
        { competencyKey: 'presentation', cefr: 'C1' },
        { competencyKey: 'active_listening', cefr: 'C1' },
        { competencyKey: 'stakeholder_exec', cefr: 'C1' },
        { competencyKey: 'cross_cultural', cefr: 'C1' },
      ];

      const result = assess(DEFAULT_CEFR_CONFIG, VP_EXPECTED, 8, ratings);

      expect(result.overallWeight).toBe(0.83);
      expect(result.overallCefr).toBe('C1');
      expect(result.overallExpectedWeight).toBe(1.00);
      expect(result.overallGap).toBe(-0.17);
      expect(result.overallStatus).toBe('BELOW');
      expect(result.isGated).toBe(true);
      expect(result.communicationReady).toBe(false);
      expect(result.developmentPriority).toHaveLength(6);
      expect(result.complete).toBe(true);
    });

    it('TV4 — Manager, uniform C1: meets C1 benchmark, gated and ready', () => {
      const ratings: RatingInput[] = [
        { competencyKey: 'written_clarity', cefr: 'C1' },
        { competencyKey: 'spoken_fluency', cefr: 'C1' },
        { competencyKey: 'presentation', cefr: 'C1' },
        { competencyKey: 'active_listening', cefr: 'C1' },
        { competencyKey: 'stakeholder_exec', cefr: 'C1' },
        { competencyKey: 'cross_cultural', cefr: 'C1' },
      ];

      const result = assess(DEFAULT_CEFR_CONFIG, MANAGER_EXPECTED, 5, ratings);

      expect(result.overallWeight).toBe(0.83);
      expect(result.overallCefr).toBe('C1');
      expect(result.overallExpectedWeight).toBe(0.83);
      expect(result.overallGap).toBe(0.00);
      expect(result.overallStatus).toBe('MEETS');
      expect(result.isGated).toBe(true);
      expect(result.communicationReady).toBe(true);
      expect(result.developmentPriority).toEqual([]);
      expect(result.complete).toBe(true);
    });

    it('TV5 — Incomplete: 5 ratings provided returns complete=false and communicationReady=null', () => {
      const ratings: RatingInput[] = [
        { competencyKey: 'written_clarity', cefr: 'B2' },
        { competencyKey: 'spoken_fluency', cefr: 'B2' },
        { competencyKey: 'presentation', cefr: 'B1' },
        { competencyKey: 'active_listening', cefr: 'B2' },
        { competencyKey: 'stakeholder_exec', cefr: 'B1' },
      ];

      const result = assess(DEFAULT_CEFR_CONFIG, SENIOR_EXPECTED, 3, ratings);

      expect(result.complete).toBe(false);
      expect(result.communicationReady).toBeNull();
      expect(result.overallWeight).toBe(0.60);
      expect(result.perCompetency).toHaveLength(5);
    });
  });

  describe('Validation & Edge Cases', () => {
    it('throws error when invalid CEFR level code is provided', () => {
      expect(() =>
        assess(DEFAULT_CEFR_CONFIG, SENIOR_EXPECTED, 3, [
          { competencyKey: 'written_clarity', cefr: 'D1' as any },
        ]),
      ).toThrow("Invalid CEFR level code: 'D1'");
    });

    it('throws error when invalid competency key is provided', () => {
      expect(() =>
        assess(DEFAULT_CEFR_CONFIG, SENIOR_EXPECTED, 3, [
          { competencyKey: 'invalid_key', cefr: 'B2' },
        ]),
      ).toThrow("Invalid competency key: 'invalid_key'");
    });

    it('throws error when duplicate competency rating is supplied', () => {
      expect(() =>
        assess(DEFAULT_CEFR_CONFIG, SENIOR_EXPECTED, 3, [
          { competencyKey: 'written_clarity', cefr: 'B1' },
          { competencyKey: 'written_clarity', cefr: 'B2' },
        ]),
      ).toThrow("Duplicate rating for competency 'written_clarity'");
    });
  });
});
