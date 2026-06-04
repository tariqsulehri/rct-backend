import {
  buildDomainScores,
  buildThresholdStats,
  getPrimaryDomain,
  scoreToPromotionStarRating,
  scoreToSkillSummaryStarRating,
  weightedOverall,
} from './reporting.engine';

const competencies = [
  {
    id: 1,
    competency_domains: [{ is_primary: true, domain: { id: 10, name: 'Cloud' } }],
  },
  {
    id: 2,
    competency_domains: [{ is_primary: true, domain: { id: 20, name: 'SRE' } }],
  },
  {
    id: 3,
    competency_domains: [{ is_primary: true, domain: { id: 10, name: 'Cloud' } }],
  },
];

describe('reporting engine', () => {
  it('resolves primary domain with fallback to first mapped domain', () => {
    expect(getPrimaryDomain([
      { is_primary: false, domain: { id: 1, name: 'Fallback' } },
      { is_primary: true, domain: { id: 2, name: 'Primary' } },
    ])).toEqual({ id: 2, name: 'Primary' });

    expect(getPrimaryDomain([
      { is_primary: false, domain: { id: 1, name: 'Fallback' } },
    ])).toEqual({ id: 1, name: 'Fallback' });
  });

  it('builds domain scores from scored competencies only', () => {
    const scores = new Map([
      [1, 0.6],
      [2, 0.3],
      [3, 0],
    ]);

    expect(buildDomainScores(scores, competencies, ['Cloud', 'SRE', 'DataOps'])).toEqual({
      Cloud: 0.6,
      SRE: 0.3,
      DataOps: 0,
    });
  });

  it('computes unweighted overall when no weights are configured', () => {
    expect(weightedOverall({ Cloud: 0.6, SRE: 0.3, DataOps: 0 })).toBeCloseTo(0.45);
  });

  it('computes weighted overall and defaults missing domain weights to one', () => {
    const weights = new Map([['Cloud', 2]]);

    expect(weightedOverall({ Cloud: 0.6, SRE: 0.3 }, weights)).toBe(0.5);
  });

  it('summarizes threshold coverage and meets counts', () => {
    const scores = new Map([
      [1, 0.8],
      [2, 0.4],
      [3, 0.2],
    ]);
    const thresholds = new Map([
      [1, 0.75],
      [2, 0.5],
      [3, 0],
    ]);

    expect(buildThresholdStats(competencies, scores, thresholds)).toEqual({
      averageThreshold: 0.625,
      thresholdCount: 2,
      meetsCount: 1,
    });
  });

  it('maps report star ratings with the existing thresholds', () => {
    expect(scoreToPromotionStarRating(0.39)).toBe(1);
    expect(scoreToPromotionStarRating(0.6)).toBe(3);
    expect(scoreToPromotionStarRating(0.95)).toBe(5);

    expect(scoreToSkillSummaryStarRating(0.59)).toBe(1);
    expect(scoreToSkillSummaryStarRating(0.6)).toBe(2);
    expect(scoreToSkillSummaryStarRating(0.95)).toBe(5);
  });
});
