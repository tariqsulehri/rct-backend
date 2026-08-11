/**
 * Behavioral Competency Rule Engine (§4 Reference Implementation)
 * 
 * Deterministic integer centi-weight arithmetic for behavioral competency evaluation.
 */

export type BehavioralLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

export const BEHAVIORAL_CENTI_WEIGHTS: Record<BehavioralLevel, number> = {
  L1: 20,
  L2: 40,
  L3: 60,
  L4: 80,
  L5: 100,
};

export const BEHAVIORAL_BANDS: [number, BehavioralLevel][] = [
  [30, 'L1'],
  [50, 'L2'],
  [70, 'L3'],
  [90, 'L4'],
  [101, 'L5'],
];

export const BEHAVIORAL_PERFORMANCE_SCALE = [
  { levelDiff: -2, score: 1, label: 'Does Not Meet' },
  { levelDiff: -1, score: 2, label: 'Partially Meets' },
  { levelDiff: 0, score: 3, label: 'Meets' },
  { levelDiff: 1, score: 4, label: 'Exceeds' },
  { levelDiff: 2, score: 5, label: 'Role Model' },
];

/** Uniform round-half-up toward +∞ */
export const rhu = (x: number): number => Math.floor(x + 0.5);

/** Clamps a value within [min, max] */
export const clamp = (x: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, x));

/** Band lookup for overall centi-weight */
export const bandOf = (cw: number): BehavioralLevel => {
  const entry = BEHAVIORAL_BANDS.find(([lt]) => cw < lt);
  return entry ? entry[1] : 'L5';
};

/** Status for a gap centi-weight */
export const statusOf = (gapCw: number): 'BELOW' | 'MEETS' | 'ABOVE' =>
  gapCw < 0 ? 'BELOW' : gapCw === 0 ? 'MEETS' : 'ABOVE';

/** Performance rating for a gap centi-weight */
export const perfOf = (gapCw: number) => {
  const d = clamp(rhu(gapCw / 20), -2, 2);
  const match = BEHAVIORAL_PERFORMANCE_SCALE.find((p) => p.levelDiff === d)!;
  return { levelDiff: d, score: match.score, label: match.label };
};

export interface BehavioralEngineConfig {
  expectedMatrix: Record<string, Record<string, BehavioralLevel | 'NA'>>;
  grades: Record<string, { ordinal: number }>;
  competencyKeys: string[];
  criticalCompetencies: string[];
  gatePolicy: 'overall' | 'all_competencies';
  gateAppliesFromOrdinal: number;
}

export interface BehavioralRatingInput {
  competencyKey: string;
  level: BehavioralLevel;
  evidence?: string;
}

export interface PerCompetencyResult {
  competencyKey: string;
  level: BehavioralLevel;
  expectedLevel: BehavioralLevel;
  gapCw: number;
  status: 'BELOW' | 'MEETS' | 'ABOVE';
  performance: { levelDiff: number; score: number; label: string };
}

export interface BehavioralEngineResult {
  overallCw: number | null;
  overallProficiency: BehavioralLevel | null;
  overallExpectedCw: number | null;
  overallGapCw: number | null;
  overallStatus: 'BELOW' | 'MEETS' | 'ABOVE' | null;
  overallPerformance: { levelDiff: number; score: number; label: string } | null;
  perCompetency: PerCompetencyResult[];
  complete: boolean;
  isGated: boolean;
  behavioralReady: boolean | null;
  developmentPriority: string[];
  ignoredRatings: string[];
}

/**
 * Assesses behavioral competency ratings against target grade configuration.
 */
export function assessBehavioral(
  cfg: BehavioralEngineConfig,
  gradeKey: string,
  ratings: BehavioralRatingInput[]
): BehavioralEngineResult {
  const exp = cfg.expectedMatrix[gradeKey] || {};
  const applicable = cfg.competencyKeys.filter((k) => exp[k] && exp[k] !== 'NA');
  const ratedMap = new Map(ratings.map((r) => [r.competencyKey, r.level]));

  // Ratings supplied for NA competencies are ignored with a warning list
  const ignoredRatings = ratings
    .filter((r) => exp[r.competencyKey] === 'NA')
    .map((r) => r.competencyKey);

  const perCompetency: PerCompetencyResult[] = applicable
    .filter((k) => ratedMap.has(k))
    .map((k) => {
      const level = ratedMap.get(k)!;
      const expectedLevel = exp[k] as BehavioralLevel;
      const gapCw = BEHAVIORAL_CENTI_WEIGHTS[level] - BEHAVIORAL_CENTI_WEIGHTS[expectedLevel];
      return {
        competencyKey: k,
        level,
        expectedLevel,
        gapCw,
        status: statusOf(gapCw),
        performance: perfOf(gapCw),
      };
    });

  const complete = applicable.every((k) => ratedMap.has(k));

  const overallCw = perCompetency.length
    ? rhu(perCompetency.reduce((sum, c) => sum + BEHAVIORAL_CENTI_WEIGHTS[c.level], 0) / perCompetency.length)
    : null;

  const overallExpectedCw = perCompetency.length
    ? rhu(
        applicable
          .filter((k) => ratedMap.has(k))
          .reduce((sum, k) => sum + BEHAVIORAL_CENTI_WEIGHTS[exp[k] as BehavioralLevel], 0) /
          perCompetency.length
      )
    : null;

  const overallGapCw =
    overallCw === null || overallExpectedCw === null ? null : overallCw - overallExpectedCw;
  const overallProficiency = overallCw === null ? null : bandOf(overallCw);
  const overallStatus = overallGapCw === null ? null : statusOf(overallGapCw);
  const overallPerformance = overallGapCw === null ? null : perfOf(overallGapCw);

  const gradeInfo = cfg.grades[gradeKey];
  const isGated = gradeInfo ? gradeInfo.ordinal >= cfg.gateAppliesFromOrdinal : true;

  // Critical competencies (e.g. Integrity) must meet their bar (gapCw >= 0)
  const criticalOk = perCompetency
    .filter((c) => cfg.criticalCompetencies.includes(c.competencyKey))
    .every((c) => c.gapCw >= 0);

  const base =
    cfg.gatePolicy === 'all_competencies'
      ? perCompetency.every((c) => c.gapCw >= 0)
      : (overallGapCw ?? -1) >= 0;

  const behavioralReady = !complete ? null : isGated ? base && criticalOk : true;

  // Development priorities sorted by most negative gap first
  const developmentPriority = perCompetency
    .filter((c) => c.status === 'BELOW')
    .sort((a, b) => a.gapCw - b.gapCw)
    .map((c) => c.competencyKey);

  return {
    overallCw,
    overallProficiency,
    overallExpectedCw,
    overallGapCw,
    overallStatus,
    overallPerformance,
    perCompetency,
    complete,
    isGated,
    behavioralReady,
    developmentPriority,
    ignoredRatings,
  };
}
