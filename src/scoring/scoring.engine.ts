export interface FormulaWeights {
  primary: number;
  secondary: number;
  tertiary: number;
}

export interface AssessmentScoreInput {
  type: string;
  projects: number;
  level: string;
  storedScore?: unknown;
}

export interface CompetencyScoreResult {
  score: number;
  starRating: number;
  levelLabel: string;
}

export const DEFAULT_FORMULA_WEIGHTS: FormulaWeights = {
  primary: 0.25,
  secondary: 0.15,
  tertiary: 0.10,
};

export const LEVEL_WEIGHT: Record<string, number> = {
  Expert: 1.0,
  Advanced: 0.8,
  Proficient: 0.6,
  Foundational: 0.4,
  Beginner: 0.4,
  Awareness: 0.2,
  Unset: 0.0,
};

export function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeAssessmentScore(
  type: string,
  projects: number,
  level: string,
  weights: FormulaWeights = DEFAULT_FORMULA_WEIGHTS,
): number {
  // The scoring model intentionally gives base credit for an assessed skill,
  // then adds project experience up to the supported 3-project cap.
  const projectCount = Math.min(Math.max(projects, 0), 3);
  const coefficient =
    type === 'Primary'
      ? weights.primary
      : type === 'Secondary'
        ? weights.secondary
        : weights.tertiary;
  const baseScore = (coefficient * projectCount / 3) + coefficient;
  const levelWeight = LEVEL_WEIGHT[level] ?? 0;

  return roundScore(baseScore * levelWeight);
}

export function scoreToStarRating(score: number): number {
  if (score <= 0) return 1;
  if (score < 0.20) return 1;
  if (score < 0.40) return 2;
  if (score < 0.65) return 3;
  if (score < 0.95) return 4;
  return 5;
}

export function scoreToLevelLabel(score: number): string {
  if (score >= 0.8) return 'L4 Expert';
  if (score >= 0.6) return 'L3 Proficient';
  if (score >= 0.4) return 'L2 Intermediate';
  if (score > 0) return 'L1 Beginner';
  return 'L0 Developing';
}

export function computeCompetencyScore(
  assessments: AssessmentScoreInput[],
  weights: FormulaWeights = DEFAULT_FORMULA_WEIGHTS,
): CompetencyScoreResult {
  const totalScore = assessments.reduce((sum, assessment) => {
    const storedScore = Number(assessment.storedScore);
    // Prefer the persisted row score so historical assessments keep the
    // formula weights that were active when they were saved.
    const assessmentScore = storedScore !== 0 && Number.isFinite(storedScore)
      ? storedScore
      : computeAssessmentScore(assessment.type, assessment.projects, assessment.level, weights);

    return sum + assessmentScore;
  }, 0);
  const score = roundScore(totalScore);

  return {
    score,
    starRating: scoreToStarRating(score),
    levelLabel: scoreToLevelLabel(score),
  };
}
