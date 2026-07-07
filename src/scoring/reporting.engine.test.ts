import {
  buildCompetencyGapDetail,
  buildCompetencyThresholdMap,
  buildDomainGapSummary,
  buildDomainScores,
  buildThresholdStats,
  calculateCompetencyGap,
  getPrimaryDomain,
  scoreToPromotionStarRating,
  scoreToSkillSummaryStarRating,
  summarizeReadiness,
  weightedOverall,
} from './reporting.engine';

const competencies = [
  {
    id: 1,
    is_critical: true,
    competency_domains: [{ is_primary: true, domain: { id: 10, name: 'Cloud' } }],
  },
  {
    id: 2,
    is_critical: false,
    competency_domains: [{ is_primary: true, domain: { id: 20, name: 'SRE' } }],
  },
  {
    id: 3,
    is_critical: false,
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
      promotionReady: false,
    });
  });

  it('builds a complete competency threshold map with zero for missing thresholds', () => {
    const thresholds = new Map([[1, 0.75]]);

    expect(buildCompetencyThresholdMap(competencies, thresholds)).toEqual(new Map([
      [1, 0.75],
      [2, 0],
      [3, 0],
    ]));

    expect(buildCompetencyThresholdMap(competencies)).toEqual(new Map([
      [1, 0],
      [2, 0],
      [3, 0],
    ]));
  });

  it('calculates missing-only and signed gaps without changing meets logic', () => {
    expect(calculateCompetencyGap(0.4, 0.75, 'missing')).toEqual({
      score: 0.4,
      threshold: 0.75,
      gap: 0.35,
      meets: false,
    });
    expect(calculateCompetencyGap(0.9, 0.75, 'missing')).toEqual({
      score: 0.9,
      threshold: 0.75,
      gap: 0,
      meets: true,
    });
    expect(calculateCompetencyGap(0.9, 0.75)).toEqual({
      score: 0.9,
      threshold: 0.75,
      gap: 0.15000000000000002,
      meets: true,
    });
  });

  it('builds competency gap details for report rows', () => {
    const scores = new Map([[1, 0.4]]);
    const thresholds = new Map([[1, 0.75]]);

    expect(buildCompetencyGapDetail(competencies[0], scores, thresholds, { mode: 'missing' })).toEqual({
      score: 0.4,
      threshold: 0.75,
      gap: 0.35,
      meets: false,
      domain: 'Cloud',
      is_critical: true,
    });

    expect(buildCompetencyGapDetail(competencies[0], scores, thresholds)).toEqual({
      score: 0.4,
      threshold: 0.75,
      gap: -0.35,
      meets: false,
      domain: 'Cloud',
      is_critical: true,
    });

    expect(buildCompetencyGapDetail(
      { id: 99, is_critical: false },
      scores,
      thresholds,
      { fallbackDomain: 'Fallback' }
    )).toEqual({
      score: 0,
      threshold: 0,
      gap: 0,
      meets: true,
      domain: 'Fallback',
      is_critical: false,
    });
  });

  it('summarizes readiness using only competencies with configured thresholds', () => {
    expect(summarizeReadiness([
      { threshold: 0.75, meets: true },
      { threshold: 0.50, meets: false },
      { threshold: 0, meets: true },
    ])).toEqual({
      meetsCount: 1,
      totalWithThreshold: 2,
      promotionReady: false,
    });

    expect(summarizeReadiness([
      { threshold: 0.75, meets: true },
      { threshold: 0.50, meets: true },
    ])).toEqual({
      meetsCount: 2,
      totalWithThreshold: 2,
      promotionReady: true,
    });
  });

  it('builds signed domain gap summaries from competency gap rows', () => {
    expect(buildDomainGapSummary([
      { domain: 'Cloud', score: 0.8, threshold: 0.75 },
      { domain: 'Cloud', score: 0.4, threshold: 0.5 },
      { domain: 'SRE', score: 0, threshold: 0 },
    ], ['Cloud', 'SRE'])).toEqual({
      Cloud: {
        score: 0.6000000000000001,
        threshold: 0.625,
        gap: -0.02499999999999991,
        meets: false,
      },
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
