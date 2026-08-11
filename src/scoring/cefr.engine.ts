import {
  CefrEngineConfig,
  CefrLevelCode,
  AssessmentStatus,
  DEFAULT_CEFR_CONFIG,
} from './cefr.config';

// ── TYPES & INTERFACES ──────────────────────────────────────────────────────

/** Rating input entry for a single CEFR communication competency */
export interface RatingInput {
  /** Competency identifier key (e.g. 'fluency', 'coherence', 'grammar') */
  competencyKey: string;
  /** Assessed CEFR level code ('A1', 'A2', 'B1', 'B2', 'C1', 'C2') */
  cefr: CefrLevelCode;
  /** Optional supporting manager evidence notes */
  evidence?: string | null;
}

/** Individual competency evaluation result detailing target level and gap */
export interface CompetencyAssessmentResult {
  /** Competency identifier key */
  competencyKey: string;
  /** Assessed CEFR level code */
  cefr: CefrLevelCode;
  /** Target expected CEFR level code for employee's grade */
  expectedCefr: CefrLevelCode;
  /** Signed numeric gap (Assessed Weight - Expected Weight) */
  gap: number;
  /** Competency status ('BELOW' | 'MEETS' | 'ABOVE') */
  status: AssessmentStatus;
  /** Manager notes */
  evidence?: string | null;
}

/** Overall CEFR communication assessment result */
export interface CefrAssessmentResult {
  /** Overall average weight across assessed competencies */
  overallWeight: number | null;
  /** Overall CEFR band code resolved from midpoint thresholds */
  overallCefr: CefrLevelCode | null;
  /** Target expected weight for employee grade level */
  overallExpectedWeight: number;
  /** Signed overall gap score */
  overallGap: number | null;
  /** Overall status ('BELOW' | 'MEETS' | 'ABOVE') */
  overallStatus: AssessmentStatus | null;
  /** Per-competency breakdown results */
  perCompetency: CompetencyAssessmentResult[];
  /** Indicates whether all required 6 communication competencies were rated */
  complete: boolean;
  /** Indicates whether promotion readiness gating rules apply to this grade */
  isGated: boolean;
  /** Promotion communication readiness decision (true/false/null) */
  communicationReady: boolean | null;
  /** Ordered list of competency keys requiring development (sorted worst gap first) */
  developmentPriority: string[];
}

// ── ENGINE HELPER UTILITIES ──────────────────────────────────────────────────

/**
 * Pure, half-up rounding function with floating-point drift safety.
 *
 * @param value - Raw float score.
 * @param decimals - Decimal places to round to (default: 2).
 * @returns Rounded float.
 */
export function roundHalfUp(value: number, decimals: number = 2): number {
  const factor = 10 ** decimals;
  const epsilon = value >= 0 ? 1e-9 : -1e-9;
  return Math.round(value * factor + epsilon) / factor;
}

/**
 * Resolves a numeric weight to a CEFR band code using midpoint thresholds.
 *
 * @param weight - Numeric CEFR weight score.
 * @param thresholds - Array of CEFR band midpoint threshold boundaries.
 * @returns Resolved CEFR band level code ('A1' through 'C2').
 */
export function bandOf(
  weight: number,
  thresholds = DEFAULT_CEFR_CONFIG.bandThresholds,
): CefrLevelCode {
  const match = thresholds.find((threshold) => weight < threshold.ltWeight);
  return match?.code ?? 'C2';
}

/**
 * Resolves a signed score gap to a status string.
 *
 * @param gap - Signed numeric gap score.
 * @returns Status string ('BELOW' if gap < 0, 'MEETS' if gap == 0, 'ABOVE' if gap > 0).
 */
export function statusOf(gap: number): AssessmentStatus {
  if (gap < 0) return 'BELOW';
  if (gap === 0) return 'MEETS';
  return 'ABOVE';
}

/**
 * Resolves the expected CEFR level for a given org level and competency,
 * applying any role-specific target overrides.
 *
 * @param cfg - CEFR engine configuration instance.
 * @param orgKey - Employee job level key (e.g. 'SSE', 'TL').
 * @param compKey - Competency identifier key.
 * @returns Target expected CEFR level code.
 *
 * @throws {Error} If `orgKey` is not defined in configuration.
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
 *
 * @param cfg - CEFR engine configuration instance.
 * @param orgKey - Employee job level key.
 * @param ratings - List of competency rating inputs.
 *
 * @throws {Error} If `orgKey` is invalid, CEFR code is unknown, or duplicate competencies exist.
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

// ── CORE CEFR EVALUATION ENGINE ─────────────────────────────────────────────

/**
 * Canonical CEFR Assessment Engine (Rules R1 - R10).
 * Pure, deterministic, dependency-free assessment function.
 *
 * Rules:
 *   - R1-R4: Validate ratings, calculate per-competency gaps against targets.
 *   - R5-R6: Calculate overall mean weight and map to CEFR band.
 *   - R7-R8: Apply grade gating rules (e.g. senior levels require all competencies >= target).
 *   - R9-R10: Generate prioritized development areas sorted worst gap first.
 *
 * @param cfg - CEFR engine rules configuration.
 * @param orgKey - Employee organizational level key.
 * @param ratings - Array of competency rating inputs.
 *
 * @returns Complete CefrAssessmentResult structure.
 *
 * @see documentation/specifications/04-architecture/system-architecture.md
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

