import {
  COMPETENCY_STAR_RATING_BANDS,
  scoreToStarRatingBand,
} from './star-rating';

// ── TYPES & CONFIGURATION INTERFACES ────────────────────────────────────────

/**
 * Coefficients representing importance weight by skill category type.
 */
export interface ScoringValues {
  /** Primary skill importance coefficient (default: 0.25) */
  primary: number;
  /** Secondary skill importance coefficient (default: 0.15) */
  secondary: number;
  /** Tertiary skill importance coefficient (default: 0.10) */
  tertiary: number;
}

/** Mapping of level code strings to numeric multiplier weights */
export type LevelWeights = Record<string, number>;

/** Mapping of project count integers to project credit coefficients */
export type ProjectCredits = Record<number, number>;

/** Single technical skill evaluation record input for scoring */
export interface AssessmentScoreInput {
  /** Skill importance category: 'Primary' | 'Secondary' | 'Tertiary' */
  type: string;
  /** Total project count applied (0 to 3+) */
  projects: number;
  /** Mastery level code (e.g. 'Expert', 'Intermediate', 'Foundational') */
  level: string;
  /** Optional persisted base score stored on the skill_assessments row */
  storedScore?: unknown;
}

/** Aggregated competency score output containing score, star band, and level title */
export interface CompetencyScoreResult {
  /** Normalized competency score [0.00 - 1.00] */
  score: number;
  /** 1-to-5 star rating band integer */
  starRating: number;
  /** Human-readable level label (e.g. 'L4 Expert', 'L3 Proficient') */
  levelLabel: string;
}

// ── DEFAULT SCORING COEFFICIENTS ───────────────────────────────────────────

/**
 * Canonical default skill category weights.
 * @see documentation/backend/scoring-formula.md
 */
export const DEFAULT_SCORING_VALUES: ScoringValues = {
  primary: 0.25,
  secondary: 0.15,
  tertiary: 0.10,
};

/**
 * Default mastery level weight multipliers.
 * @see documentation/backend/scoring-formula.md
 */
export const LEVEL_WEIGHT: Record<string, number> = {
  Expert: 1.0,
  Advanced: 0.8,
  Proficient: 0.6,
  Intermediate: 0.4,
  Foundational: 0.4,
  Beginner: 0.4,
  Awareness: 0.2,
  Unset: 0.0,
};

// ── HELPER UTILITIES ────────────────────────────────────────────────────────

/**
 * Rounds a floating-point score to 2 decimal places.
 *
 * @param value - Raw floating-point number.
 * @returns Score rounded to 2 decimal places.
 */
export function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Clamps a score between 0.00 and 1.00 inclusive.
 *
 * @param value - Numeric score input.
 * @returns Clamped score within [0.00, 1.00].
 */
export function clampScore(value: number): number {
  return Math.min(1, Math.max(0, value));
}

// ── CORE TECHNICAL SCORING ENGINE ──────────────────────────────────────────

/**
 * Computes the normalized score for a single technical skill evaluation.
 *
 * Mathematical Model:
 *   Project Credit = Min(Max(Projects, 0), 3) / 3.0
 *   Base Score     = (Type Coeff * Project Credit) + Type Coeff
 *   Final Score    = Round(Base Score * Level Weight, 2)
 *
 * Rationale:
 *   - Base credit is awarded for an assessed skill regardless of project count.
 *   - Experience credit adds proportional boost up to a 3-project cap.
 *   - Final score is scaled by the technical mastery level weight.
 *
 * @param type - Skill category: 'Primary', 'Secondary', or 'Tertiary'.
 * @param projects - Project count applied (clamped 0 to 3).
 * @param level - Skill level code string (e.g. 'Expert', 'Intermediate').
 * @param scoringValues - Dynamic category coefficients (defaults to DB/canonical standards).
 * @param levelWeights - Dynamic level multiplier weights.
 * @param projectCredits - Optional custom project credit mappings.
 *
 * @returns Normalized tool score rounded to 2 decimal places [0.00 - 1.00].
 *
 * @see documentation/backend/scoring-formula.md Section 2.1
 */
export function computeAssessmentScore(
  type: string,
  projects: number,
  level: string,
  scoringValues: ScoringValues = DEFAULT_SCORING_VALUES,
  levelWeights: LevelWeights = LEVEL_WEIGHT,
  projectCredits: ProjectCredits = {},
): number {
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

/**
 * Maps a normalized competency score to a 1-to-5 star rating band.
 *
 * @param score - Competency score [0.00 - 1.00].
 * @returns Star rating integer between 1 and 5.
 *
 * @see documentation/backend/scoring-formula.md Section 2.3
 */
export function scoreToStarRating(score: number): number {
  return scoreToStarRatingBand(score, COMPETENCY_STAR_RATING_BANDS);
}

/**
 * Maps a normalized competency score to a human-readable level title.
 *
 * @param score - Competency score [0.00 - 1.00].
 * @returns Level string ('L4 Expert' | 'L3 Proficient' | 'L2 Intermediate' | 'L1 Beginner' | 'L0 Developing').
 */
export function scoreToLevelLabel(score: number): string {
  if (score >= 0.8) return 'L4 Expert';
  if (score >= 0.6) return 'L3 Proficient';
  if (score >= 0.4) return 'L2 Intermediate';
  if (score > 0) return 'L1 Beginner';
  return 'L0 Developing';
}

/**
 * Aggregates a list of tool assessments under a single competency into a overall competency score.
 *
 * Policy Note:
 *   Prefers persisted `storedScore` values from `skill_assessments` to ensure historical
 *   evaluations preserve the exact coefficient snapshot active when assessed.
 *
 * @param assessments - Array of skill evaluation inputs for the target competency.
 * @param scoringValues - Dynamic skill category weights.
 * @param levelWeights - Dynamic level multiplier weights.
 * @param projectCredits - Dynamic project credit mappings.
 *
 * @returns Aggregated CompetencyScoreResult containing score, star rating, and level title.
 *
 * @see documentation/backend/scoring-formula.md Section 2.2
 */
export function computeCompetencyScore(
  assessments: AssessmentScoreInput[],
  scoringValues: ScoringValues = DEFAULT_SCORING_VALUES,
  levelWeights: LevelWeights = LEVEL_WEIGHT,
  projectCredits: ProjectCredits = {},
): CompetencyScoreResult {
  const totalScore = assessments.reduce((sum, assessment) => {
    const storedScore = Number(assessment.storedScore);
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

