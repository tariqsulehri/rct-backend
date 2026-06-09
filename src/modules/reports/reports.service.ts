import { db } from '../../config/database';
import logger from '../../config/logger';
import {
  buildDomainScores,
  buildThresholdStats,
  getPrimaryDomain,
  scoreToPromotionStarRating,
  scoreToSkillSummaryStarRating,
  weightedOverall,
} from '../../scoring/reporting.engine';

// ── Canonical scoring architecture ───────────────────────────────────────────
// skill_assessments.score  = formula1(type, projects, scoring values) × levelWeight   (stored per row)
// competency_scores.score  = SUM(skill_assessments.score)  per employee+competency  (stored)
// All reports READ from competency_scores — never recalculate from raw assessments.
// Domain score  = AVG of scored competencies in that domain
// Overall score = equal AVG of scored domains for now. Grade readiness is driven
// by competency_grade_thresholds via the GradeMatrix Prisma model.

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Load stored competency scores for a set of employees.
 * Returns Map<employeeId, Map<competencyId, score>>
 */
async function getStoredCompScores(
  employeeIds: number[]
): Promise<Map<number, Map<number, number>>> {
  const rows = await db.competencyScore.findMany({
    where: { employee_id: { in: employeeIds } },
    select: { employee_id: true, competency_id: true, score: true },
  });
  const result = new Map<number, Map<number, number>>();
  for (const row of rows) {
    if (row.score == null) continue;
    if (!result.has(row.employee_id)) result.set(row.employee_id, new Map());
    result.get(row.employee_id)!.set(row.competency_id, row.score);
  }
  return result;
}

async function loadDomainWeights(gradeIds: number[]): Promise<Map<number, Map<string, number>>> {
  void gradeIds;
  return new Map();
}

async function loadGradeThresholds(
  departmentIds: number[],
  gradeIds: number[]
): Promise<Map<string, Map<number, number>>> {
  if (departmentIds.length === 0 || gradeIds.length === 0) return new Map();
  const rows = await db.gradeMatrix.findMany({
    where: {
      department_id: { in: departmentIds },
      grade_id: { in: gradeIds },
    },
    select: { department_id: true, grade_id: true, competency_id: true, threshold: true },
  });
  const result = new Map<string, Map<number, number>>();
  for (const row of rows) {
    const key = `${row.department_id}:${row.grade_id}`;
    if (!result.has(key)) result.set(key, new Map());
    result.get(key)!.set(row.competency_id, row.threshold);
  }
  return result;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface GapEntry {
  competency_id: number;
  competency_name: string;
  domain_name: string;
  score: number;
  threshold: number;
  gap: number;
  meets_grade: boolean;
  is_critical: boolean;
}

// ── 1. Gap Analysis ───────────────────────────────────────────────────────────

export async function gapAnalysis(employeeId: number) {
  logger.info({ employeeId }, 'Running gap analysis');

  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    include: { current_grade: true, target_grade: true },
  });
  if (!employee) throw Object.assign(new Error('Employee not found'), { statusCode: 404 });

  const allCompetencies = await db.competency.findMany({
    include: { competency_domains: { include: { domain: true } } },
  });
  const allDomains = await db.skillDomain.findMany({ orderBy: { name: 'asc' } });
  const domainNames = allDomains.map((d) => d.name);

  // Read stored competency scores for this employee
  const storedMap = await getStoredCompScores([employeeId]);
  const compScoreMap = storedMap.get(employeeId) ?? new Map<number, number>();

  // Fetch department-specific grade matrix thresholds for target grade
  const gradeMatrices = employee.department_id
    ? await db.gradeMatrix.findMany({
        where: { department_id: employee.department_id, grade_id: employee.target_grade_id },
      })
    : [];
  const thresholdMap = new Map<number, number>(gradeMatrices.map((gm) => [gm.competency_id, gm.threshold]));

  const gaps: GapEntry[] = allCompetencies.map((comp) => {
    const pd = getPrimaryDomain(comp.competency_domains, employee.department_id);
    const score = compScoreMap.get(comp.id) ?? 0;
    const threshold = thresholdMap.get(comp.id) ?? 0;
    const gap = Math.max(0, threshold - score);
    return {
      competency_id: comp.id,
      competency_name: comp.name,
      domain_name: pd.name,
      score,
      threshold,
      gap,
      meets_grade: score >= threshold,
      is_critical: comp.is_critical,
    };
  });

  gaps.sort((a, b) => {
    if (a.meets_grade !== b.meets_grade) return a.meets_grade ? 1 : -1;
    return b.gap - a.gap;
  });

  // Only count competencies that have a threshold defined for the target grade
  // (consistent with promotionReadiness which uses threshold_count)
  const meets_count = gaps.filter((g) => g.threshold > 0 && g.meets_grade).length;
  const total_competencies = gaps.filter((g) => g.threshold > 0).length;

  // overall_score: weighted by domain grade weights for the employee's target grade
  const domainWeightMap = await loadDomainWeights([employee.target_grade_id]);
  const gradeWeights = domainWeightMap.get(employee.target_grade_id);
  const domainScores = buildDomainScores(compScoreMap, allCompetencies, domainNames, employee.department_id);
  const overall_score = weightedOverall(domainScores, gradeWeights);

  return {
    employee: {
      id: employee.id,
      emp_code: employee.emp_code,
      full_name: employee.full_name,
      current_grade: employee.current_grade.code,
      target_grade: employee.target_grade.code,
    },
    overall_score,
    promotion_ready: meets_count === total_competencies && total_competencies > 0,
    total_competencies,
    meets_count,
    gaps,
  };
}

// ── 2. Promotion Readiness ────────────────────────────────────────────────────

async function getEmployeesForManager(managerId: number, role: string, employeeId?: number) {
  if (employeeId) {
    return db.employee.findMany({
      where: {
        id: employeeId,
        deleted_at: null,
        ...(role === 'MANAGER'
          ? { OR: [{ id: managerId }, { manager_id: managerId }] }
          : {}),
      },
      include: { current_grade: true, target_grade: true },
    });
  }
  if (role === 'ADMIN') {
    return db.employee.findMany({
      where: { deleted_at: null },
      include: { current_grade: true, target_grade: true },
    });
  }
  if (role === 'MANAGER') {
    return db.employee.findMany({
      where: {
        deleted_at: null,
        OR: [{ id: managerId }, { manager_id: managerId }],
      },
      include: { current_grade: true, target_grade: true },
    });
  }
  return db.employee.findMany({
    where: { id: managerId, deleted_at: null },
    include: { current_grade: true, target_grade: true },
  });
}

export async function promotionReadiness(managerId: number, role: string) {
  logger.info({ managerId, role }, 'Running promotion readiness report');

  const employees = await getEmployeesForManager(managerId, role);
  const employeeIds = employees.map((e) => e.id);

  const allCompetencies = await db.competency.findMany({
    include: { competency_domains: { include: { domain: true } } },
  });
  const allDomains = await db.skillDomain.findMany({ orderBy: { name: 'asc' } });
  const domainNames = allDomains.map((d) => d.name);

  const targetGradeIds = [...new Set(employees.map((e) => e.target_grade_id))];
  const departmentIds = [...new Set(employees.map((e) => e.department_id).filter((id): id is number => id != null))];
  const gradeThresholds = await loadGradeThresholds(departmentIds, targetGradeIds);

  const domainWeightMap = await loadDomainWeights(targetGradeIds);

  // Read stored competency scores for all employees at once
  const storedScores = await getStoredCompScores(employeeIds);

  const results = [];

  for (const emp of employees) {
    const compScoreMap = storedScores.get(emp.id) ?? new Map<number, number>();

    // Domain scores = avg of scored competencies, weighted by grade
    const domainScores = buildDomainScores(compScoreMap, allCompetencies, domainNames, emp.department_id);
    const overall_score = weightedOverall(domainScores, domainWeightMap.get(emp.target_grade_id));

    const thresholdMap = new Map<number, number>();
    for (const comp of allCompetencies) {
      const thresholds = emp.department_id
        ? gradeThresholds.get(`${emp.department_id}:${emp.target_grade_id}`)
        : undefined;
      thresholdMap.set(comp.id, thresholds?.get(comp.id) ?? 0);
    }
    const {
      averageThreshold: avg_threshold,
      thresholdCount: threshold_count,
      meetsCount: meets_count,
    } = buildThresholdStats(allCompetencies, compScoreMap, thresholdMap);
    const promotion_ready = threshold_count > 0 && meets_count === threshold_count;

    results.push({
      employee_id: emp.id,
      emp_code: emp.emp_code,
      full_name: emp.full_name,
      current_grade: emp.current_grade.code,
      target_grade: emp.target_grade.code,
      overall_score,
      avg_threshold,
      meets_count,
      total_competencies: threshold_count,   // only competencies with defined thresholds for this target grade
      promotion_ready,
      star_rating: scoreToPromotionStarRating(overall_score),
    });
  }

  results.sort((a, b) => b.overall_score - a.overall_score);
  return results;
}

// ── 3. Competency Scores ──────────────────────────────────────────────────────

export async function competencyScores(managerId: number, role: string, _employeeId?: number) {
  logger.info({ managerId, role }, 'Running competency scores report');

  const employees = await getEmployeesForManager(managerId, role);
  const employeeIds = employees.map((e) => e.id);

  const allCompetencies = await db.competency.findMany({
    include: { competency_domains: { include: { domain: true } } },
  });
  const allDomains = await db.skillDomain.findMany({ orderBy: { name: 'asc' } });
  const domainNames = allDomains.map((d) => d.name);

  const targetGradeIds = [...new Set(employees.map((e) => e.target_grade_id))];
  const domainWeightMap = await loadDomainWeights(targetGradeIds);
  const storedScores = await getStoredCompScores(employeeIds);

  const results = [];

  for (const emp of employees) {
    const compScoreMap = storedScores.get(emp.id) ?? new Map<number, number>();
    const domain_scores = buildDomainScores(compScoreMap, allCompetencies, domainNames, emp.department_id);
    const overall_score = weightedOverall(domain_scores, domainWeightMap.get(emp.target_grade_id));

    results.push({
      employee_id: emp.id,
      full_name: emp.full_name,
      emp_code: emp.emp_code,
      current_grade: emp.current_grade.code,
      current_grade_title: emp.current_grade.title,
      target_grade: emp.target_grade.code,
      target_grade_title: emp.target_grade.title,
      domain_scores,
      overall_score,
    });
  }

  return results;
}

// ── 4. Assessment History ─────────────────────────────────────────────────────

export async function assessmentHistory(
  managerId: number,
  role: string,
  page: number,
  limit: number
) {
  logger.info({ managerId, role, page, limit }, 'Running assessment history report');

  const skip = (page - 1) * limit;

  let employeeIdFilter: { in: number[] } | undefined;
  if (role !== 'ADMIN') {
    const directReports = await db.employee.findMany({
      where: { manager_id: managerId, deleted_at: null },
      select: { id: true },
    });
    employeeIdFilter = { in: directReports.map((e) => e.id) };
  }

  const where = employeeIdFilter ? { employee_id: employeeIdFilter } : {};

  const [total, assessments] = await Promise.all([
    db.skillAssessment.count({ where }),
    db.skillAssessment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { assessed_at: 'desc' },
      include: {
        employee: true,
        technology: {
          include: {
            competency: { include: { competency_domains: { include: { domain: true } } } },
          },
        },
      },
    }),
  ]);

  const assessedByIds = [...new Set(assessments.map((a) => a.assessed_by))];
  const assessedByEmployees = await db.employee.findMany({
    where: { id: { in: assessedByIds } },
    select: { id: true, full_name: true },
  });
  const assessedByMap = new Map(assessedByEmployees.map((e) => [e.id, e.full_name]));

  const data = assessments.map((a) => ({
    id: a.id,
    employee_name: a.employee.full_name,
    emp_code: a.employee.emp_code,
    technology_name: a.technology.name,
    competency_name: a.technology.competency.name,
    domain_name: getPrimaryDomain(a.technology.competency.competency_domains, a.employee.department_id).name,
    type: a.type,
    projects: a.projects,
    score: Number(a.score),   // stored score — formula1 × levelWeight, 2 dp
    assessed_by_name: assessedByMap.get(a.assessed_by) ?? 'Unknown',
    assessed_at: a.assessed_at,
  }));

  return { data, total, page, limit };
}

// ── 5. Competency Matrix ──────────────────────────────────────────────────────

export async function competencyMatrix(managerId: number, role: string, employeeId?: number) {
  logger.info({ managerId, role }, 'Running competency matrix report');

  const employees = await getEmployeesForManager(managerId, role, employeeId);
  const employeeIds = employees.map((e) => e.id);

  const allCompetencies = await db.competency.findMany({
    include: { competency_domains: { include: { domain: true } } },
  });
  const allDomains = await db.skillDomain.findMany({ orderBy: { name: 'asc' } });
  const domainNames = allDomains.map((d) => d.name);

  // Order: domain name → competency name
  const orderedComps = allCompetencies
    .map((comp) => {
      const pd = getPrimaryDomain(comp.competency_domains);
      return { id: comp.id, name: comp.name, domain_name: pd.name, is_critical: comp.is_critical };
    })
    .sort((a, b) => a.domain_name.localeCompare(b.domain_name) || a.name.localeCompare(b.name));

  const targetGradeIds = [...new Set(employees.map((e) => e.target_grade_id))];
  const domainWeightMap = await loadDomainWeights(targetGradeIds);
  const storedScores = await getStoredCompScores(employeeIds);

  const results = [];

  for (const emp of employees) {
    const compScoreMap = storedScores.get(emp.id) ?? new Map<number, number>();

    const competency_scores: Record<string, { score: number; domain: string; is_critical: boolean }> = {};
    for (const comp of orderedComps) {
      const score = compScoreMap.get(comp.id) ?? 0;
      const source = allCompetencies.find((c) => c.id === comp.id);
      const domain = source ? getPrimaryDomain(source.competency_domains, emp.department_id).name : comp.domain_name;
      competency_scores[comp.name] = { score, domain, is_critical: comp.is_critical };
    }

    const domain_scores = buildDomainScores(compScoreMap, allCompetencies, domainNames, emp.department_id);
    const overall_score = weightedOverall(domain_scores, domainWeightMap.get(emp.target_grade_id));

    results.push({
      employee_id: emp.id,
      emp_code: emp.emp_code,
      full_name: emp.full_name,
      current_grade: emp.current_grade.code,
      target_grade: emp.target_grade.code,
      overall_score,
      competency_scores,
    });
  }

  results.sort((a, b) => b.overall_score - a.overall_score);

  return {
    employees: results,
    competencies: orderedComps.map((c) => ({
      name: c.name,
      domain: c.domain_name,
      is_critical: c.is_critical,
    })),
  };
}

// ── 6. Gap Matrix ─────────────────────────────────────────────────────────────

export async function gapMatrix(managerId: number, role: string, employeeId?: number) {
  logger.info({ managerId, role }, 'Running gap matrix report');

  const employees = await getEmployeesForManager(managerId, role, employeeId);
  const employeeIds = employees.map((e) => e.id);

  const allCompetencies = await db.competency.findMany({
    include: { competency_domains: { include: { domain: true } } },
  });

  const allDomains = await db.skillDomain.findMany({ orderBy: { name: 'asc' } });
  const domainNames = allDomains.map((d) => d.name);

  const orderedComps = allCompetencies
    .map((comp) => {
      const pd = getPrimaryDomain(comp.competency_domains);
      return { id: comp.id, name: comp.name, domain: pd.name, is_critical: comp.is_critical };
    })
    .sort((a, b) => a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name));

  const targetGradeIds = [...new Set(employees.map((e) => e.target_grade_id))];
  const departmentIds = [...new Set(employees.map((e) => e.department_id).filter((id): id is number => id != null))];
  const matrixMap = await loadGradeThresholds(departmentIds, targetGradeIds);
  const domainWeightMap = await loadDomainWeights(targetGradeIds);
  const storedScores = await getStoredCompScores(employeeIds);

  const results: Array<{
    employee_id: number; emp_code: string; full_name: string;
    current_grade: string; target_grade: string;
    overall_score: number; overall_threshold: number; overall_gap: number;
    meets_count: number; total_with_threshold: number; promotion_ready: boolean;
    domain_gaps: Record<string, { score: number; threshold: number; gap: number; meets: boolean }>;
    competency_gaps: Record<string, { score: number; threshold: number; gap: number; domain: string; is_critical: boolean; meets: boolean }>;
  }> = [];

  for (const emp of employees) {
    const compScoreMap = storedScores.get(emp.id) ?? new Map<number, number>();
    const thresholds = emp.department_id
      ? matrixMap.get(`${emp.department_id}:${emp.target_grade_id}`) ?? new Map<number, number>()
      : new Map<number, number>();

    // Competency gaps
    const competency_gaps: Record<string, {
      score: number; threshold: number; gap: number; domain: string; is_critical: boolean; meets: boolean;
    }> = {};
    for (const comp of orderedComps) {
      const score = compScoreMap.get(comp.id) ?? 0;
      const threshold = thresholds.get(comp.id) ?? 0;
      const source = allCompetencies.find((c) => c.id === comp.id);
      const domain = source ? getPrimaryDomain(source.competency_domains, emp.department_id).name : comp.domain;
      competency_gaps[comp.name] = { score, threshold, gap: score - threshold, domain, is_critical: comp.is_critical, meets: score >= threshold };
    }

    // Domain gaps = avg over competencies in that domain
    const domainAcc = new Map<string, { scoreSum: number; threshSum: number; count: number }>();
    for (const dn of domainNames) domainAcc.set(dn, { scoreSum: 0, threshSum: 0, count: 0 });
    for (const comp of orderedComps) {
      const cg = competency_gaps[comp.name];
      const acc = domainAcc.get(cg.domain);
      if (!acc) continue;
      if (cg.threshold > 0 || cg.score > 0) {
        acc.scoreSum += cg.score;
        acc.threshSum += cg.threshold;
        acc.count++;
      }
    }
    const domain_gaps: Record<string, { score: number; threshold: number; gap: number; meets: boolean }> = {};
    for (const dn of domainNames) {
      const acc = domainAcc.get(dn)!;
      if (acc.count === 0) continue;
      const score = acc.scoreSum / acc.count;
      const threshold = acc.threshSum / acc.count;
      domain_gaps[dn] = { score, threshold, gap: score - threshold, meets: score >= threshold };
    }

    const gradeWeights = domainWeightMap.get(emp.target_grade_id);
    // overall_score: use buildDomainScores (consistent with all other report functions)
    const domainScoresForOverall = buildDomainScores(compScoreMap, allCompetencies, domainNames, emp.department_id);
    const overall_score = weightedOverall(domainScoresForOverall, gradeWeights);
    // overall_threshold: weighted avg of domain thresholds (only domains with threshold > 0)
    const thresholdRecord: Record<string, number> = Object.fromEntries(
      Object.entries(domain_gaps).filter(([, d]) => d.threshold > 0).map(([k, d]) => [k, d.threshold])
    );
    const overall_threshold = weightedOverall(thresholdRecord, gradeWeights);
    const meets_count = Object.values(competency_gaps).filter((c) => c.meets && c.threshold > 0).length;
    const total_with_threshold = Object.values(competency_gaps).filter((c) => c.threshold > 0).length;

    results.push({
      employee_id: emp.id, emp_code: emp.emp_code, full_name: emp.full_name,
      current_grade: emp.current_grade.code, target_grade: emp.target_grade.code,
      overall_score, overall_threshold, overall_gap: overall_score - overall_threshold,
      meets_count, total_with_threshold,
      promotion_ready: meets_count === total_with_threshold && total_with_threshold > 0,
      domain_gaps, competency_gaps,
    });
  }

  results.sort((a, b) => b.overall_score - a.overall_score);

  return {
    employees: results,
    domains: domainNames.filter((dn) => results.some((r) => r.domain_gaps[dn])),
    competencies: orderedComps.map((c) => ({ name: c.name, domain: c.domain, is_critical: c.is_critical })),
  };
}

// ── 7. Skills Summary ─────────────────────────────────────────────────────────

export async function skillsSummary(managerId: number, role: string, employeeId?: number) {
  logger.info({ managerId, role }, 'Running skills summary report');

  const employees = await getEmployeesForManager(managerId, role, employeeId);
  const employeeIds = employees.map((e) => e.id);

  const allCompetencies = await db.competency.findMany({
    include: { competency_domains: { include: { domain: true } } },
  });
  const allDomains = await db.skillDomain.findMany({ orderBy: { name: 'asc' } });
  const domainNames = allDomains.map((d) => d.name);

  const targetGradeIds = [...new Set(employees.map((e) => e.target_grade_id))];
  const domainWeightMap = await loadDomainWeights(targetGradeIds);
  const storedScores = await getStoredCompScores(employeeIds);

  const results = [];

  for (const emp of employees) {
    const compScoreMap = storedScores.get(emp.id) ?? new Map<number, number>();
    const domain_scores = buildDomainScores(compScoreMap, allCompetencies, domainNames, emp.department_id);
    const final_score = weightedOverall(domain_scores, domainWeightMap.get(emp.target_grade_id));

    results.push({
      employee_id: emp.id,
      emp_code: emp.emp_code,
      full_name: emp.full_name,
      current_grade: emp.current_grade.code,
      target_grade: emp.target_grade.code,
      domain_scores,
      final_score,
      star_rating: scoreToSkillSummaryStarRating(final_score),
    });
  }

  results.sort((a, b) => b.final_score - a.final_score);
  return { employees: results, domains: domainNames };
}
