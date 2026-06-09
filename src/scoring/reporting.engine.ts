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

export function buildThresholdStats(
  competencies: Array<{ id: number }>,
  competencyScores: Map<number, number>,
  thresholds: Map<number, number>,
): ThresholdStats {
  let thresholdSum = 0;
  let thresholdCount = 0;
  let meetsCount = 0;

  for (const competency of competencies) {
    const threshold = thresholds.get(competency.id) ?? 0;
    if (threshold <= 0) continue;

    thresholdSum += threshold;
    thresholdCount++;
    if ((competencyScores.get(competency.id) ?? 0) >= threshold) {
      meetsCount++;
    }
  }

  return {
    averageThreshold: thresholdCount > 0 ? thresholdSum / thresholdCount : 0,
    thresholdCount,
    meetsCount,
  };
}

export function scoreToPromotionStarRating(score: number): number {
  if (score < 0.4) return 1;
  if (score < 0.6) return 2;
  if (score < 0.75) return 3;
  if (score < 0.95) return 4;
  return 5;
}

export function scoreToSkillSummaryStarRating(score: number): number {
  const pct = score * 100;
  if (pct >= 95) return 5;
  if (pct >= 90) return 4;
  if (pct >= 75) return 3;
  if (pct >= 60) return 2;
  return 1;
}
