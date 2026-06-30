import {
  computeAssessmentScore,
  computeCompetencyScore,
  scoreToLevelLabel,
  scoreToStarRating,
} from './scoring.engine';

describe('scoring engine', () => {
  it('computes assessment scores using type, projects, and level scoring values', () => {
    expect(computeAssessmentScore('Primary', 3, 'Expert')).toBe(0.5);
    expect(computeAssessmentScore('Secondary', 3, 'Advanced')).toBe(0.24);
    expect(computeAssessmentScore('Tertiary', 3, 'Awareness')).toBe(0.04);
  });

  it('clamps project counts to the supported 0 to 3 range', () => {
    expect(computeAssessmentScore('Primary', -1, 'Expert')).toBe(0.25);
    expect(computeAssessmentScore('Primary', 4, 'Expert')).toBe(0.5);
  });

  it('uses department-specific scoring values when provided', () => {
    const scoringValues = { primary: 0.5, secondary: 0.3, tertiary: 0.2 };

    expect(computeAssessmentScore('Primary', 3, 'Expert', scoringValues)).toBe(1);
    expect(computeAssessmentScore('Secondary', 0, 'Proficient', scoringValues)).toBe(0.18);
  });

  it('maps competency scores to star ratings at current thresholds', () => {
    expect(scoreToStarRating(0)).toBe(1);
    expect(scoreToStarRating(0.2)).toBe(2);
    expect(scoreToStarRating(0.4)).toBe(3);
    expect(scoreToStarRating(0.65)).toBe(4);
    expect(scoreToStarRating(0.95)).toBe(5);
  });

  it('maps competency scores to level labels at current thresholds', () => {
    expect(scoreToLevelLabel(0)).toBe('L0 Developing');
    expect(scoreToLevelLabel(0.01)).toBe('L1 Beginner');
    expect(scoreToLevelLabel(0.4)).toBe('L2 Intermediate');
    expect(scoreToLevelLabel(0.6)).toBe('L3 Proficient');
    expect(scoreToLevelLabel(0.8)).toBe('L4 Expert');
  });

  it('sums stored assessment scores and returns derived competency metadata', () => {
    expect(
      computeCompetencyScore([
        { type: 'Primary', projects: 3, level: 'Expert', storedScore: '0.50' },
        { type: 'Secondary', projects: 3, level: 'Expert', storedScore: 0.3 },
      ]),
    ).toEqual({
      score: 0.8,
      starRating: 4,
      levelLabel: 'L4 Expert',
    });
  });

  it('caps competency scores at 100 percent', () => {
    expect(
      computeCompetencyScore([
        { type: 'Primary', projects: 3, level: 'Expert', storedScore: '0.50' },
        { type: 'Primary', projects: 3, level: 'Expert', storedScore: '0.50' },
        { type: 'Secondary', projects: 3, level: 'Expert', storedScore: 0.3 },
      ]),
    ).toEqual({
      score: 1,
      starRating: 5,
      levelLabel: 'L4 Expert',
    });
  });

  it('falls back to live assessment computation for legacy zero scores', () => {
    expect(
      computeCompetencyScore([
        { type: 'Primary', projects: 3, level: 'Expert', storedScore: 0 },
      ]),
    ).toEqual({
      score: 0.5,
      starRating: 3,
      levelLabel: 'L2 Intermediate',
    });
  });
});
