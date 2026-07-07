import {
  PROMOTION_STAR_RATING_BANDS,
  SKILL_SUMMARY_STAR_RATING_BANDS,
  scoreToStarRatingBand,
} from './star-rating';

export interface DomainRef {
  id: number;
  name: string;
}

export interface CompetencyDomainRef {
  department_id?: number;
  is_primary: boolean;
  domain: DomainRef;
}

export interface DomainScoredCompetency {
  id: number;
  competency_domains: CompetencyDomainRef[];
}

export interface ThresholdStats {
  averageThreshold: number;
  thresholdCount: number;
  meetsCount: number;
  promotionReady: boolean;
}

export type GapMode = 'missing' | 'signed';

export interface ScoreThresholdGap {
  score: number;
  threshold: number;
  gap: number;
  meets: boolean;
}

export interface CompetencyGapDetail extends ScoreThresholdGap {
  domain: string;
  is_critical: boolean;
}

export interface ReadinessSummary {
  meetsCount: number;
  totalWithThreshold: number;
  promotionReady: boolean;
}

export interface DomainGapRow {
  domain: string;
  score: number;
  threshold: number;
}

export interface DomainGapSummary {
  score: number;
  threshold: number;
  gap: number;
  meets: boolean;
}

export function getPrimaryDomain(competencyDomains: CompetencyDomainRef[], departmentId?: number | null): DomainRef {
  // Reporting assigns each competency to one display domain even when the
  // taxonomy links it to multiple domains.
  const departmentMaps = departmentId
    ? competencyDomains.filter((domainMap) => domainMap.department_id === departmentId)
    : [];
  const maps = departmentMaps.length > 0 ? departmentMaps : competencyDomains;
  const primary = maps.find((domainMap) => domainMap.is_primary);
  return primary?.domain ?? maps[0]?.domain ?? { id: 0, name: 'Unknown' };
}

export function buildDomainScores(
  competencyScores: Map<number, number>,
  competencies: DomainScoredCompetency[],
  domainNames: string[],
  departmentId?: number | null,
): Record<string, number> {
  const domainTotals = new Map<string, { sum: number; count: number }>();
  for (const domainName of domainNames) {
    domainTotals.set(domainName, { sum: 0, count: 0 });
  }

  for (const competency of competencies) {
    const score = competencyScores.get(competency.id) ?? 0;
    // Unassessed competencies stay visible elsewhere, but they should not pull
    // down domain averages or overall scores.
    if (score <= 0) continue;

    const domainName = getPrimaryDomain(competency.competency_domains, departmentId).name;
    const total = domainTotals.get(domainName);
    if (!total) continue;

    total.sum += score;
    total.count++;
  }

  const domainScores: Record<string, number> = {};
  for (const domainName of domainNames) {
    const total = domainTotals.get(domainName)!;
    domainScores[domainName] = total.count > 0 ? total.sum / total.count : 0;
  }

  return domainScores;
}

export function weightedOverall(
  domainScores: Record<string, number>,
  weights?: Map<string, number>,
): number {
  // Average only domains with evidence of assessment; empty domains remain zero
  // in the response for table shape consistency.
  const scoredDomains = Object.entries(domainScores).filter(([, score]) => score > 0);
  if (scoredDomains.length === 0) return 0;

  if (!weights || weights.size === 0) {
    return scoredDomains.reduce((sum, [, score]) => sum + score, 0) / scoredDomains.length;
  }

  let weightedSum = 0;
  let totalWeight = 0;
  for (const [domainName, score] of scoredDomains) {
    const weight = weights.get(domainName) ?? 1.0;
    weightedSum += score * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

export function buildCompetencyThresholdMap(
  competencies: Array<{ id: number }>,
  thresholds?: Map<number, number>,
): Map<number, number> {
  const thresholdMap = new Map<number, number>();
  for (const competency of competencies) {
    thresholdMap.set(competency.id, thresholds?.get(competency.id) ?? 0);
  }
  return thresholdMap;
}

export function buildThresholdStats(
  competencies: Array<{ id: number }>,
  competencyScores: Map<number, number>,
  thresholds: Map<number, number>,
): ThresholdStats {
  let thresholdSum = 0;
  const gaps: ScoreThresholdGap[] = [];

  for (const competency of competencies) {
    const threshold = thresholds.get(competency.id) ?? 0;
    if (threshold <= 0) continue;

    thresholdSum += threshold;
    gaps.push(calculateCompetencyGap(competencyScores.get(competency.id) ?? 0, threshold));
  }
  const readiness = summarizeReadiness(gaps);

  return {
    averageThreshold: readiness.totalWithThreshold > 0 ? thresholdSum / readiness.totalWithThreshold : 0,
    thresholdCount: readiness.totalWithThreshold,
    meetsCount: readiness.meetsCount,
    promotionReady: readiness.promotionReady,
  };
}

export function buildCompetencyGapDetail(
  competency: { id: number; is_critical: boolean; competency_domains?: CompetencyDomainRef[] },
  competencyScores: Map<number, number>,
  thresholds: Map<number, number>,
  options: { departmentId?: number | null; mode?: GapMode; fallbackDomain?: string } = {},
): CompetencyGapDetail {
  const score = competencyScores.get(competency.id) ?? 0;
  const threshold = thresholds.get(competency.id) ?? 0;
  const gap = calculateCompetencyGap(score, threshold, options.mode);
  const domain = competency.competency_domains
    ? getPrimaryDomain(competency.competency_domains, options.departmentId).name
    : options.fallbackDomain ?? 'Unknown';

  return {
    score: gap.score,
    threshold: gap.threshold,
    gap: gap.gap,
    meets: gap.meets,
    domain,
    is_critical: competency.is_critical,
  };
}

export function calculateCompetencyGap(
  score: number,
  threshold: number,
  mode: GapMode = 'signed',
): ScoreThresholdGap {
  return {
    score,
    threshold,
    gap: mode === 'missing' ? Math.max(0, threshold - score) : score - threshold,
    meets: score >= threshold,
  };
}

export function summarizeReadiness(items: Array<{ threshold: number; meets: boolean }>): ReadinessSummary {
  const thresholdItems = items.filter((item) => item.threshold > 0);
  const meetsCount = thresholdItems.filter((item) => item.meets).length;

  return {
    meetsCount,
    totalWithThreshold: thresholdItems.length,
    promotionReady: thresholdItems.length > 0 && meetsCount === thresholdItems.length,
  };
}

export function buildDomainGapSummary(
  rows: DomainGapRow[],
  domainNames: string[],
): Record<string, DomainGapSummary> {
  const domainAcc = new Map<string, { scoreSum: number; threshSum: number; count: number }>();
  for (const domainName of domainNames) {
    domainAcc.set(domainName, { scoreSum: 0, threshSum: 0, count: 0 });
  }

  for (const row of rows) {
    const acc = domainAcc.get(row.domain);
    if (!acc) continue;
    if (row.threshold > 0 || row.score > 0) {
      acc.scoreSum += row.score;
      acc.threshSum += row.threshold;
      acc.count++;
    }
  }

  const domainGaps: Record<string, DomainGapSummary> = {};
  for (const domainName of domainNames) {
    const acc = domainAcc.get(domainName)!;
    if (acc.count === 0) continue;
    const score = acc.scoreSum / acc.count;
    const threshold = acc.threshSum / acc.count;
    domainGaps[domainName] = calculateCompetencyGap(score, threshold);
  }

  return domainGaps;
}

export function scoreToPromotionStarRating(score: number): number {
  return scoreToStarRatingBand(score, PROMOTION_STAR_RATING_BANDS);
}

export function scoreToSkillSummaryStarRating(score: number): number {
  return scoreToStarRatingBand(score, SKILL_SUMMARY_STAR_RATING_BANDS);
}
