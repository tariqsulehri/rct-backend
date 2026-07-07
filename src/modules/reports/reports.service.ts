import { db } from '../../config/database';
import logger from '../../config/logger';
import {
  buildCompetencyGapDetail,
  buildCompetencyThresholdMap,
  buildDomainGapSummary,
  buildDomainScores,
  buildThresholdStats,
  calculateCompetencyGap,
  getPrimaryDomain,
  scoreToPromotionStarRating,
  scoreToSkillSummaryStarRating,
  summarizeReadiness,
  weightedOverall,
} from '../../scoring/reporting.engine';
import { RoleCode } from '../../types/rbac';
import {
  getAccessibleReportEmployeeIds,
  getEmployeesForManager,
  getGradeThresholdMap,
  getReportDepartmentIds,
  getReportTargetGradeIds,
  getStoredCompScores,
  loadDomainWeights,
  loadGradeThresholds,
  loadReportSkillContext,
} from './report-data.service';
import {
  buildGapAnalysisEmployeeSummary,
  buildOrderedReportCompetencies,
  buildReportEmployeeSummary,
  buildReportEmployeeSummaryWithGradeTitles,
} from './report-row.helpers';

// ── Canonical scoring architecture ───────────────────────────────────────────
// skill_assessments.score  = formula1(type, projects, scoring values) × levelWeight   (stored per row)
// competency_scores.score  = SUM(skill_assessments.score)  per employee+competency  (stored)
// All reports READ from competency_scores — never recalculate from raw assessments.
// Domain score  = AVG of scored competencies in that domain
// Overall score = equal AVG of scored domains for now. Grade readiness is driven
// by competency_grade_thresholds via the GradeMatrix Prisma model.

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
    include: { current_grade: true, target_grade: true, dept: true },
  });
  if (!employee) throw Object.assign(new Error('Employee not found'), { statusCode: 404 });

  const { allCompetencies, domainNames } = await loadReportSkillContext();

  // Read stored competency scores for this employee
  const storedMap = await getStoredCompScores([employeeId]);
  const compScoreMap = storedMap.get(employeeId) ?? new Map<number, number>();

  // Fetch department-specific grade matrix thresholds for target grade
  const gradeThresholds = await loadGradeThresholds(
    employee.department_id ? [employee.department_id] : [],
    [employee.target_grade_id]
  );
  const thresholdMap = getGradeThresholdMap(
    gradeThresholds,
    employee.department_id,
    employee.target_grade_id
  );

  const gaps: GapEntry[] = allCompetencies.map((comp) => {
    const gap = buildCompetencyGapDetail(comp, compScoreMap, thresholdMap, {
      departmentId: employee.department_id,
      mode: 'missing',
    });
    return {
      competency_id: comp.id,
      competency_name: comp.name,
      domain_name: gap.domain,
      score: gap.score,
      threshold: gap.threshold,
      gap: gap.gap,
      meets_grade: gap.meets,
      is_critical: gap.is_critical,
    };
  });

  gaps.sort((a, b) => {
    if (a.meets_grade !== b.meets_grade) return a.meets_grade ? 1 : -1;
    return b.gap - a.gap;
  });

  // Only count competencies that have a threshold defined for the target grade
  // (consistent with promotionReadiness which uses threshold_count)
  const readiness = summarizeReadiness(gaps.map((gap) => ({ threshold: gap.threshold, meets: gap.meets_grade })));
  const meets_count = readiness.meetsCount;
  const total_competencies = readiness.totalWithThreshold;

  // overall_score: weighted by domain grade weights for the employee's target grade
  const domainWeightMap = await loadDomainWeights([employee.target_grade_id]);
  const gradeWeights = domainWeightMap.get(employee.target_grade_id);
  const domainScores = buildDomainScores(compScoreMap, allCompetencies, domainNames, employee.department_id);
  const overall_score = weightedOverall(domainScores, gradeWeights);

  return {
    employee: buildGapAnalysisEmployeeSummary(employee),
    overall_score,
    promotion_ready: readiness.promotionReady,
    total_competencies,
    meets_count,
    gaps,
  };
}

// ── 2. Promotion Readiness ────────────────────────────────────────────────────

export async function promotionReadiness(userId: number, managerId: number, role: RoleCode) {
  logger.info({ managerId, role }, 'Running promotion readiness report');

  const employees = await getEmployeesForManager(userId, managerId, role);
  const employeeIds = employees.map((e) => e.id);

  const { allCompetencies, domainNames } = await loadReportSkillContext();

  const targetGradeIds = getReportTargetGradeIds(employees);
  const departmentIds = getReportDepartmentIds(employees);
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

    const thresholds = getGradeThresholdMap(gradeThresholds, emp.department_id, emp.target_grade_id);
    const thresholdMap = buildCompetencyThresholdMap(allCompetencies, thresholds);
    const {
      averageThreshold: avg_threshold,
      thresholdCount: threshold_count,
      meetsCount: meets_count,
      promotionReady: promotion_ready,
    } = buildThresholdStats(allCompetencies, compScoreMap, thresholdMap);

    results.push({
      ...buildReportEmployeeSummary(emp),
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

export async function competencyScores(userId: number, managerId: number, role: RoleCode, _employeeId?: number) {
  logger.info({ managerId, role }, 'Running competency scores report');

  const employees = await getEmployeesForManager(userId, managerId, role);
  const employeeIds = employees.map((e) => e.id);

  const { allCompetencies, domainNames } = await loadReportSkillContext();

  const targetGradeIds = getReportTargetGradeIds(employees);
  const domainWeightMap = await loadDomainWeights(targetGradeIds);
  const storedScores = await getStoredCompScores(employeeIds);

  const results = [];

  for (const emp of employees) {
    const compScoreMap = storedScores.get(emp.id) ?? new Map<number, number>();
    const domain_scores = buildDomainScores(compScoreMap, allCompetencies, domainNames, emp.department_id);
    const overall_score = weightedOverall(domain_scores, domainWeightMap.get(emp.target_grade_id));

    results.push({
      ...buildReportEmployeeSummaryWithGradeTitles(emp),
      domain_scores,
      overall_score,
    });
  }

  return results;
}

// ── 4. Assessment History ─────────────────────────────────────────────────────

export async function assessmentHistory(
  userId: number,
  managerId: number,
  role: RoleCode,
  page: number,
  limit: number
) {
  logger.info({ managerId, role, page, limit }, 'Running assessment history report');

  const skip = (page - 1) * limit;

  const employeeIds = await getAccessibleReportEmployeeIds(userId, managerId, role);
  const where = { employee_id: { in: employeeIds } };

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

export async function competencyMatrix(userId: number, managerId: number, role: RoleCode, employeeId?: number) {
  logger.info({ managerId, role }, 'Running competency matrix report');

  const employees = await getEmployeesForManager(userId, managerId, role, employeeId);
  const employeeIds = employees.map((e) => e.id);

  const { allCompetencies, competencyById, domainNames } = await loadReportSkillContext();

  const orderedComps = buildOrderedReportCompetencies(allCompetencies);

  const targetGradeIds = getReportTargetGradeIds(employees);
  const domainWeightMap = await loadDomainWeights(targetGradeIds);
  const storedScores = await getStoredCompScores(employeeIds);

  const results = [];

  for (const emp of employees) {
    const compScoreMap = storedScores.get(emp.id) ?? new Map<number, number>();

    const competency_scores: Record<string, { score: number; domain: string; is_critical: boolean }> = {};
    for (const comp of orderedComps) {
      const score = compScoreMap.get(comp.id) ?? 0;
      const source = competencyById.get(comp.id);
      const domain = source ? getPrimaryDomain(source.competency_domains, emp.department_id).name : comp.domain;
      competency_scores[comp.name] = { score, domain, is_critical: comp.is_critical };
    }

    const domain_scores = buildDomainScores(compScoreMap, allCompetencies, domainNames, emp.department_id);
    const overall_score = weightedOverall(domain_scores, domainWeightMap.get(emp.target_grade_id));

    results.push({
      ...buildReportEmployeeSummary(emp),
      overall_score,
      competency_scores,
    });
  }

  results.sort((a, b) => b.overall_score - a.overall_score);

  return {
    employees: results,
    competencies: orderedComps.map((c) => ({
      name: c.name,
      domain: c.domain,
      is_critical: c.is_critical,
    })),
  };
}

// ── 6. Gap Matrix ─────────────────────────────────────────────────────────────

export async function gapMatrix(userId: number, managerId: number, role: RoleCode, employeeId?: number) {
  logger.info({ managerId, role }, 'Running gap matrix report');

  const employees = await getEmployeesForManager(userId, managerId, role, employeeId);
  const employeeIds = employees.map((e) => e.id);

  const { allCompetencies, competencyById, domainNames } = await loadReportSkillContext();

  const orderedComps = buildOrderedReportCompetencies(allCompetencies);

  const targetGradeIds = getReportTargetGradeIds(employees);
  const departmentIds = getReportDepartmentIds(employees);
  const matrixMap = await loadGradeThresholds(departmentIds, targetGradeIds);
  const domainWeightMap = await loadDomainWeights(targetGradeIds);
  const storedScores = await getStoredCompScores(employeeIds);

  const results: Array<{
    employee_id: number; emp_code: string; full_name: string; department: string;
    current_grade: string; target_grade: string;
    overall_score: number; overall_threshold: number; overall_gap: number;
    meets_count: number; total_with_threshold: number; promotion_ready: boolean;
    domain_gaps: Record<string, { score: number; threshold: number; gap: number; meets: boolean }>;
    competency_gaps: Record<string, { score: number; threshold: number; gap: number; domain: string; is_critical: boolean; meets: boolean }>;
  }> = [];

  for (const emp of employees) {
    const compScoreMap = storedScores.get(emp.id) ?? new Map<number, number>();
    const thresholds = getGradeThresholdMap(matrixMap, emp.department_id, emp.target_grade_id);

    // Competency gaps
    const competency_gaps: Record<string, {
      score: number; threshold: number; gap: number; domain: string; is_critical: boolean; meets: boolean;
    }> = {};
    for (const comp of orderedComps) {
      const source = competencyById.get(comp.id);
      const gap = buildCompetencyGapDetail(
        source ?? { id: comp.id, is_critical: comp.is_critical },
        compScoreMap,
        thresholds,
        { departmentId: emp.department_id, fallbackDomain: comp.domain }
      );
      competency_gaps[comp.name] = {
        score: gap.score,
        threshold: gap.threshold,
        gap: gap.gap,
        domain: gap.domain,
        is_critical: gap.is_critical,
        meets: gap.meets,
      };
    }

    const domain_gaps = buildDomainGapSummary(Object.values(competency_gaps), domainNames);

    const gradeWeights = domainWeightMap.get(emp.target_grade_id);
    // overall_score: use buildDomainScores (consistent with all other report functions)
    const domainScoresForOverall = buildDomainScores(compScoreMap, allCompetencies, domainNames, emp.department_id);
    const overall_score = weightedOverall(domainScoresForOverall, gradeWeights);
    // overall_threshold: weighted avg of domain thresholds (only domains with threshold > 0)
    const thresholdRecord: Record<string, number> = Object.fromEntries(
      Object.entries(domain_gaps).filter(([, d]) => d.threshold > 0).map(([k, d]) => [k, d.threshold])
    );
    const overall_threshold = weightedOverall(thresholdRecord, gradeWeights);
    const readiness = summarizeReadiness(Object.values(competency_gaps));
    const overall_gap = calculateCompetencyGap(overall_score, overall_threshold).gap;

    results.push({
      ...buildReportEmployeeSummary(emp),
      overall_score, overall_threshold, overall_gap,
      meets_count: readiness.meetsCount, total_with_threshold: readiness.totalWithThreshold,
      promotion_ready: readiness.promotionReady,
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

export async function skillsSummary(userId: number, managerId: number, role: RoleCode, employeeId?: number) {
  logger.info({ managerId, role }, 'Running skills summary report');

  const employees = await getEmployeesForManager(userId, managerId, role, employeeId);
  const employeeIds = employees.map((e) => e.id);

  const { allCompetencies, domainNames } = await loadReportSkillContext();

  const targetGradeIds = getReportTargetGradeIds(employees);
  const domainWeightMap = await loadDomainWeights(targetGradeIds);
  const storedScores = await getStoredCompScores(employeeIds);

  const results = [];

  for (const emp of employees) {
    const compScoreMap = storedScores.get(emp.id) ?? new Map<number, number>();
    const domain_scores = buildDomainScores(compScoreMap, allCompetencies, domainNames, emp.department_id);
    const final_score = weightedOverall(domain_scores, domainWeightMap.get(emp.target_grade_id));

    results.push({
      ...buildReportEmployeeSummary(emp),
      domain_scores,
      final_score,
      star_rating: scoreToSkillSummaryStarRating(final_score),
    });
  }

  results.sort((a, b) => b.final_score - a.final_score);
  return { employees: results, domains: domainNames };
}
