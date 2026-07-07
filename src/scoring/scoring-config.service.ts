import type { PrismaClient } from '@prisma/client';
import {
  DEFAULT_SCORING_VALUES,
  LEVEL_WEIGHT,
  LevelWeights,
  ProjectCredits,
  ScoringValues,
} from './scoring.engine';

type StatusLookupWhere = {
  counts_toward_score?: boolean;
  is_terminal?: boolean;
};

export type ScoringConfigBundle = {
  scoringValues: ScoringValues;
  levelWeights: LevelWeights;
  projectCredits: ProjectCredits;
  scoredStatuses: string[];
};

export type AssessmentScoreConfig = Pick<
  ScoringConfigBundle,
  'scoringValues' | 'levelWeights' | 'projectCredits'
>;

type ScoringConfigServiceOptions = {
  fallbackOnError?: boolean;
};

export function createScoringConfigService(
  client: PrismaClient,
  options: ScoringConfigServiceOptions = {},
) {
  const fallbackOnError = options.fallbackOnError ?? true;

  const withFallback = async <T>(operation: () => Promise<T>, fallback: T): Promise<T> => {
    if (!fallbackOnError) return operation();

    try {
      return await operation();
    } catch {
      return fallback;
    }
  };

  const getConfiguredScoringValues = async (): Promise<ScoringValues> => (
    withFallback(async () => {
      const configs = await client.assessmentTypeConfig.findMany({
        where: { code: { in: ['Primary', 'Secondary', 'Tertiary'] }, is_active: true },
      });
      const byCode = new Map(configs.map((config) => [config.code, config.weight]));
      return {
        primary: byCode.get('Primary') ?? DEFAULT_SCORING_VALUES.primary,
        secondary: byCode.get('Secondary') ?? DEFAULT_SCORING_VALUES.secondary,
        tertiary: byCode.get('Tertiary') ?? DEFAULT_SCORING_VALUES.tertiary,
      };
    }, DEFAULT_SCORING_VALUES)
  );

  const getConfiguredLevelWeights = async (): Promise<LevelWeights> => (
    withFallback(async () => {
      const configs = await client.assessmentLevelConfig.findMany({ where: { is_active: true } });
      return {
        ...LEVEL_WEIGHT,
        ...Object.fromEntries(configs.map((config) => [config.code, config.weight])),
      };
    }, LEVEL_WEIGHT)
  );

  const getConfiguredProjectCredits = async (): Promise<ProjectCredits> => (
    withFallback(async () => {
      const configs = await client.assessmentProjectConfig.findMany({ where: { is_active: true } });
      return Object.fromEntries(configs.map((config) => [config.project_count, config.credit]));
    }, {})
  );

  const getScoredAssessmentStatuses = async (): Promise<string[]> => (
    withFallback(async () => {
      const configs = await client.assessmentStatusConfig.findMany({
        where: { is_active: true, counts_toward_score: true },
        select: { code: true },
      });
      const statuses = configs.map((config) => config.code);
      return statuses.length > 0 ? statuses : ['approved'];
    }, ['approved'])
  );

  const getConfiguredStatusCode = async (
    preferredCode: string,
    where: StatusLookupWhere,
    fallbackCode: string,
  ): Promise<string> => (
    withFallback(async () => {
      const preferred = await client.assessmentStatusConfig.findUnique({
        where: { code: preferredCode },
        select: { code: true, is_active: true },
      });
      if (preferred?.is_active) return preferred.code;

      const configured = await client.assessmentStatusConfig.findFirst({
        where: { is_active: true, ...where },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
        select: { code: true },
      });
      return configured?.code ?? fallbackCode;
    }, fallbackCode)
  );

  const getAssessmentScoreConfig = async (): Promise<AssessmentScoreConfig> => {
    const [scoringValues, levelWeights, projectCredits] = await Promise.all([
      getConfiguredScoringValues(),
      getConfiguredLevelWeights(),
      getConfiguredProjectCredits(),
    ]);

    return { scoringValues, levelWeights, projectCredits };
  };

  const getScoringConfigBundle = async (): Promise<ScoringConfigBundle> => {
    const [scoringValues, levelWeights, projectCredits, scoredStatuses] = await Promise.all([
      getConfiguredScoringValues(),
      getConfiguredLevelWeights(),
      getConfiguredProjectCredits(),
      getScoredAssessmentStatuses(),
    ]);

    return { scoringValues, levelWeights, projectCredits, scoredStatuses };
  };

  return {
    getConfiguredScoringValues,
    getConfiguredLevelWeights,
    getConfiguredProjectCredits,
    getScoredAssessmentStatuses,
    getConfiguredStatusCode,
    getAssessmentScoreConfig,
    getScoringConfigBundle,
  };
}
