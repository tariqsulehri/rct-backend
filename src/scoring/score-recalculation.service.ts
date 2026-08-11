import type { PrismaClient } from '@prisma/client';
import {
  computeCompetencyScore,
  DEFAULT_SCORING_VALUES,
  LEVEL_WEIGHT,
  LevelWeights,
  ProjectCredits,
  ScoringValues,
} from './scoring.engine';
import {
  ScoringConfigBundle,
  createScoringConfigService,
} from './scoring-config.service';

// ── TYPES & OPTIONS INTERFACES ──────────────────────────────────────────────

type ScoringConfigReader = {
  getScoringConfigBundle: () => Promise<ScoringConfigBundle>;
};

type ScoreRecalculationLogger = {
  debug?: (obj: unknown, msg?: string) => void;
  error?: (obj: unknown, msg?: string) => void;
};

/** Service creation options for custom config loader or logging */
type ScoreRecalculationServiceOptions = {
  scoringConfigService?: ScoringConfigReader;
  logger?: ScoreRecalculationLogger;
  swallowErrors?: boolean;
};

type RecomputeOneInput = {
  employeeId: number;
  competencyId: number;
  departmentId: number | null;
  scoredStatuses: string[];
  scoringValues?: ScoringValues;
  levelWeights?: LevelWeights;
  projectCredits?: ProjectCredits;
};

/** Result of a single competency score recomputation */
export type RecomputedCompetencyResult = {
  employeeId: number;
  competencyId: number;
  score: number | null;
  starRating: number | null;
  levelLabel: string | null;
};

/** Summary result of a full employee score recomputation */
export type RecomputedEmployeeResult = {
  employeeId: number;
  competencyIds: number[];
  updatedCount: number;
  clearedCount: number;
  failed?: boolean;
};

// ── SCORE RECALCULATION SERVICE FACTORY ──────────────────────────────────────

/**
 * Creates the ScoreRecalculationService instance for orchestrating competency score refreshes.
 *
 * @summary Service factory for employee and competency score recomputations.
 *
 * @param client - Prisma database client or transaction instance.
 * @param options - Configuration options for logging and error handling.
 * @returns Service object exposing `recomputeOneCompetency` and `recomputeScoresForEmployee`.
 *
 * @see documentation/backend/scoring-formula.md
 */
export function createScoreRecalculationService(
  client: PrismaClient,
  options: ScoreRecalculationServiceOptions = {},
) {
  const scoringConfigService = options.scoringConfigService ?? createScoringConfigService(client);
  const swallowErrors = options.swallowErrors ?? false;
  const serviceLogger = options.logger;

  /**
   * Recomputes and upserts a single `competency_scores` database row for an employee.
   *
   * @summary Recomputes single competency score from active technical assessments.
   *
   * @param input - Employee ID, competency ID, department, and scoring coefficients.
   * @returns RecomputedCompetencyResult object containing score, star rating, and level label.
   *
   * @transactional Executes an atomic `competencyScore.upsert` operation.
   */
  const recomputeOneCompetency = async ({
    employeeId,
    competencyId,
    departmentId,
    scoredStatuses,
    scoringValues = DEFAULT_SCORING_VALUES,
    levelWeights = LEVEL_WEIGHT,
    projectCredits = {},
  }: RecomputeOneInput): Promise<RecomputedCompetencyResult> => {
    const competency = await client.competency.findUnique({ where: { id: competencyId }, select: { is_active: true } });

    const technologies = await client.technology.findMany({
      where: { competency_id: competencyId, is_active: true },
      select: { id: true },
    });
    const techIds = technologies.map((technology) => technology.id);

    const assessments = await client.skillAssessment.findMany({
      where: {
        employee_id: employeeId,
        technology_id: { in: techIds },
        status: { in: scoredStatuses },
      },
    });

    if (assessments.length === 0 || competency?.is_active === false) {
      await client.competencyScore.upsert({
        where: { employee_id_competency_id: { employee_id: employeeId, competency_id: competencyId } },
        create: { employee_id: employeeId, department_id: departmentId, competency_id: competencyId, score: null, level_label: null, star_rating: null },
        update: { department_id: departmentId, score: null, level_label: null, star_rating: null },
      });

      return { employeeId, competencyId, score: null, starRating: null, levelLabel: null };
    }

    const { score, starRating, levelLabel } = computeCompetencyScore(
      assessments.map((assessment) => ({
        type: assessment.type,
        projects: assessment.projects,
        level: assessment.level,
        storedScore: assessment.score,
      })),
      scoringValues,
      levelWeights,
      projectCredits,
    );

    await client.competencyScore.upsert({
      where: { employee_id_competency_id: { employee_id: employeeId, competency_id: competencyId } },
      create: { employee_id: employeeId, department_id: departmentId, competency_id: competencyId, score, level_label: levelLabel, star_rating: starRating },
      update: { department_id: departmentId, score, level_label: levelLabel, star_rating: starRating },
    });

    serviceLogger?.debug?.({ employeeId, competencyId, score, starRating, levelLabel, scoringValues }, 'Competency score recomputed');

    return { employeeId, competencyId, score, starRating, levelLabel };
  };

  /**
   * Recalculates all competency scores for a specific employee across all assessed and active competencies.
   *
   * @summary Bulk recomputes all competency scores for an employee.
   *
   * @param employeeId - Employee internal database ID.
   * @param scoringConfig - Optional pre-fetched scoring configuration bundle.
   * @returns RecomputedEmployeeResult containing updated count and status.
   *
   * @transactional Batch updates `competency_scores` for each evaluated competency.
   */
  const recomputeScoresForEmployee = async (
    employeeId: number,
    scoringConfig?: ScoringConfigBundle,
  ): Promise<RecomputedEmployeeResult> => {
    try {
      const [resolvedScoringConfig, employee] = await Promise.all([
        scoringConfig ? Promise.resolve(scoringConfig) : scoringConfigService.getScoringConfigBundle(),
        client.employee.findUnique({
          where: { id: employeeId },
          select: { department_id: true },
        }),
      ]);
      const { scoringValues, levelWeights, projectCredits, scoredStatuses } = resolvedScoringConfig;
      const departmentId = employee?.department_id ?? null;

      const assessed = await client.skillAssessment.findMany({
        where: { employee_id: employeeId },
        include: { technology: { select: { competency_id: true } } },
      });
      const assessedCompetencyIds = assessed.map((assessment) => assessment.technology.competency_id);

      const existingScores = await client.competencyScore.findMany({
        where: { employee_id: employeeId },
        select: { competency_id: true },
      });
      const competencyIds = [
        ...new Set([...assessedCompetencyIds, ...existingScores.map((score) => score.competency_id)]),
      ];

      let updatedCount = 0;
      let clearedCount = 0;
      for (const competencyId of competencyIds) {
        const result = await recomputeOneCompetency({
          employeeId,
          competencyId,
          departmentId,
          scoredStatuses,
          scoringValues,
          levelWeights,
          projectCredits,
        });
        updatedCount++;
        if (result.score == null) clearedCount++;
      }

      return { employeeId, competencyIds, updatedCount, clearedCount };
    } catch (err) {
      serviceLogger?.error?.({ err, employeeId }, 'recomputeScoresForEmployee failed');
      if (!swallowErrors) throw err;
      return { employeeId, competencyIds: [], updatedCount: 0, clearedCount: 0, failed: true };
    }
  };

  return {
    recomputeOneCompetency,
    recomputeScoresForEmployee,
  };
}

