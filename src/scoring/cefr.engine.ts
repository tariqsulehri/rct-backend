import {
  CefrEngineConfig,
  CefrLevelCode,
  AssessmentStatus,
  DEFAULT_CEFR_CONFIG,
} from './cefr.config';

export interface RatingInput {
  competencyKey: string;
  cefr: CefrLevelCode;
  evidence?: string | null;
}

export interface CompetencyAssessmentResult {
  competencyKey: string;
  cefr: CefrLevelCode;
  expectedCefr: CefrLevelCode;
  gap: number;
  status: AssessmentStatus;
  evidence?: string | null;
}

export interface CefrAssessmentResult {
  overallWeight: number | null;
  overallCefr: CefrLevelCode | null;
  overallExpectedWeight: number;
  overallGap: number | null;
  overallStatus: AssessmentStatus | null;
  perCompetency: CompetencyAssessmentResult[];
  complete: boolean;
  isGated: boolean;
  communicationReady: boolean | null;
  developmentPriority: string[];
}

/**
 * Pure, half-up rounding function with floating-point drift safety.
 */
export function roundHalfUp(value: number, decimals: number = 2): number {
  const factor = 10 ** decimals;
  const epsilon = value >= 0 ? 1e-9 : -1e-9;
  return Math.round(value * factor + epsilon) / factor;
}

/**
 * Resolves a weight to a CEFR band code using midpoint thresholds.
 */
export function bandOf(
  weight: number,
  thresholds = DEFAULT_CEFR_CONFIG.bandThresholds,
): CefrLevelCode {
  const match = thresholds.find((threshold) => weight < threshold.ltWeight);
  return match?.code ?? 'C2';
}

/**
 * Resolves gap to status string.
 */
export function statusOf(gap: number): AssessmentStatus {
  if (gap < 0) return 'BELOW';
  if (gap === 0) return 'MEETS';
  return 'ABOVE';
}

/**
 * Resolves the expected CEFR level for a given org level and competency,
 * applying any role-specific target overrides.
 */
export function expectedFor(
  cfg: CefrEngineConfig,
  orgKey: string,
  compKey: string,
): CefrLevelCode {
  const override = cfg.targetOverrides[orgKey]?.[compKey];
  if (override) return override;

  const orgLevel = cfg.orgLevels[orgKey];
  if (!orgLevel) {
    throw new Error(`Unknown org level: '${orgKey}'`);
  }
  return orgLevel.expectedCefr;
}

/**
 * Validates rating inputs against engine configuration.
 */
export function validateRatings(
  cfg: CefrEngineConfig,
  orgKey: string,
  ratings: RatingInput[],
): void {
  if (!cfg.orgLevels[orgKey]) {
    throw new Error(`Invalid org level key: '${orgKey}'`);
  }

  const validCompKeys = new Set(cfg.competencies.map((c) => c.key));
  const seenComps = new Set<string>();

  for (const rating of ratings) {
    if (!cfg.cefrLevels[rating.cefr]) {
      throw new Error(`Invalid CEFR level code: '${rating.cefr}'`);
    }

    if (!validCompKeys.has(rating.competencyKey)) {
      throw new Error(`Invalid competency key: '${rating.competencyKey}'`);
    }

    if (seenComps.has(rating.competencyKey)) {
      throw new Error(
        `Duplicate rating for competency '${rating.competencyKey}' in the same assessment`,
      );
    }
    seenComps.add(rating.competencyKey);
  }
}

/**
 * Canonical CEFR Assessment Engine (Rules R1 - R10)
 * Pure, deterministic, dependency-free function.
 */
export function assess(
  cfg: CefrEngineConfig = DEFAULT_CEFR_CONFIG,
  orgKey: string,
  ratings: RatingInput[],
): CefrAssessmentResult {
  validateRatings(cfg, orgKey, ratings);

  const org = cfg.orgLevels[orgKey];
  const requiredCompKeys = cfg.competencies.map((c) => c.key);
  const complete =
    ratings.length === requiredCompKeys.length &&
    requiredCompKeys.every((k) => ratings.some((r) => r.competencyKey === k));

  const perCompetency: CompetencyAssessmentResult[] = ratings.map((r) => {
    const exp = expectedFor(cfg, orgKey, r.competencyKey);
    const ratingWeight = cfg.cefrLevels[r.cefr].weight;
    const expWeight = cfg.cefrLevels[exp].weight;
    const gap = roundHalfUp(ratingWeight - expWeight, cfg.policy.roundDecimals);

    return {
      competencyKey: r.competencyKey,
      cefr: r.cefr,
      expectedCefr: exp,
      gap,
      status: statusOf(gap),
      evidence: r.evidence,
    };
  });

  const overallWeight = ratings.length
    ? roundHalfUp(
        ratings.reduce((sum, r) => sum + cfg.cefrLevels[r.cefr].weight, 0) / ratings.length,
        cfg.policy.roundDecimals,
      )
    : null;

  const overallCefr =
    overallWeight !== null ? bandOf(overallWeight, cfg.bandThresholds) : null;
  const overallExpectedWeight = cfg.cefrLevels[org.expectedCefr].weight;
  const overallGap =
    overallWeight !== null
      ? roundHalfUp(overallWeight - overallExpectedWeight, cfg.policy.roundDecimals)
      : null;
  const overallStatus = overallGap !== null ? statusOf(overallGap) : null;

  const isGated = org.ordinal >= cfg.policy.gateFromOrdinal;

  let communicationReady: boolean | null;
  if (!complete) {
    communicationReady = null;
  } else if (!isGated) {
    communicationReady = true;
  } else if (cfg.policy.gatePolicy === 'all_competencies') {
    communicationReady = perCompetency.every((c) => c.gap >= 0);
  } else {
    communicationReady = (overallGap ?? -1) >= 0;
  }

  const developmentPriority = perCompetency
    .filter((c) => c.status === 'BELOW')
    .sort((a, b) => a.gap - b.gap)
    .map((c) => c.competencyKey);

  return {
    overallWeight,
    overallCefr,
    overallExpectedWeight,
    overallGap,
    overallStatus,
    perCompetency,
    complete,
    isGated,
    communicationReady,
    developmentPriority,
  };
}
