import {
  COMPETENCY_STAR_RATING_BANDS,
  scoreToStarRatingBand,
} from './star-rating';

export interface ScoringValues {
  primary: number;
  secondary: number;
  tertiary: number;
}

export type LevelWeights = Record<string, number>;
export type ProjectCredits = Record<number, number>;

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

export const DEFAULT_SCORING_VALUES: ScoringValues = {
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

export function clampScore(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function computeAssessmentScore(
  type: string,
  projects: number,
  level: string,
  scoringValues: ScoringValues = DEFAULT_SCORING_VALUES,
  levelWeights: LevelWeights = LEVEL_WEIGHT,
  projectCredits: ProjectCredits = {},
): number {
  // The scoring model intentionally gives base credit for an assessed skill,
  // then adds project experience up to the supported 3-project cap.
  const projectCount = Math.min(Math.max(projects, 0), 3);
  const projectCredit = projectCredits[projectCount] ?? (projectCount / 3);
  const scoringValue =
    type === 'Primary'
      ? scoringValues.primary
      : type === 'Secondary'
        ? scoringValues.secondary
        : scoringValues.tertiary;
  const baseScore = (scoringValue * projectCredit) + scoringValue;
  const levelWeight = levelWeights[level] ?? LEVEL_WEIGHT[level] ?? 0;

  return roundScore(baseScore * levelWeight);
}

export function scoreToStarRating(score: number): number {
  return scoreToStarRatingBand(score, COMPETENCY_STAR_RATING_BANDS);
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
  scoringValues: ScoringValues = DEFAULT_SCORING_VALUES,
  levelWeights: LevelWeights = LEVEL_WEIGHT,
  projectCredits: ProjectCredits = {},
): CompetencyScoreResult {
  const totalScore = assessments.reduce((sum, assessment) => {
    const storedScore = Number(assessment.storedScore);
    // Prefer the persisted row score so historical assessments keep the
    // scoring values that were active when they were saved.
    const assessmentScore = storedScore !== 0 && Number.isFinite(storedScore)
      ? storedScore
      : computeAssessmentScore(assessment.type, assessment.projects, assessment.level, scoringValues, levelWeights, projectCredits);

    return sum + assessmentScore;
  }, 0);
  const score = roundScore(clampScore(totalScore));

  return {
    score,
    starRating: scoreToStarRating(score),
    levelLabel: scoreToLevelLabel(score),
  };
}
