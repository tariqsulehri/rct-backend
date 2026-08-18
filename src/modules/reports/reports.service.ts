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
import { DEFAULT_CEFR_CONFIG, CefrLevelCode } from '../../scoring/cefr.config';
import { assess, RatingInput } from '../../scoring/cefr.engine';
import { gradeLevelToOrgLevelKey } from '../communication/communication.service';
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

function evaluateEmployeeCefr(empTargetGradeLevel: number, cefrRecord?: any) {
  const orgKey = gradeLevelToOrgLevelKey(empTargetGradeLevel ?? 2);
  const cefrExpected = DEFAULT_CEFR_CONFIG.orgLevels[orgKey]?.expectedCefr ?? 'B2';

  if (!cefrRecord || !cefrRecord.ratings || cefrRecord.ratings.length === 0) {
    return {
      cefrLevel: 'B1' as CefrLevelCode,
      cefrExpected,
      isCefrGated: true,
      isCefrReady: false,
    };
  }

  const ratingsInput: RatingInput[] = cefrRecord.ratings.map((r: any) => ({
    competencyKey: r.competency_key,
    cefr: r.cefr as CefrLevelCode,
    evidence: r.evidence,
  }));

  const evaluation = assess(DEFAULT_CEFR_CONFIG, orgKey, ratingsInput);
  const cefrLevel = evaluation.overallCefr ?? 'B1';
  const isCefrReady = evaluation.communicationReady ?? false;
  const isCefrGated = !isCefrReady;

  return {
    cefrLevel,
    cefrExpected,
    isCefrGated,
    isCefrReady,
  };
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

  const cefrAssessments = await db.commAssessment.findMany({
    where: { employee_id: { in: employeeIds }, status: 'approved' },
    orderBy: { assessed_at: 'desc' },
    distinct: ['employee_id'],
    include: { ratings: true },
  });
  const cefrMap = new Map(cefrAssessments.map((a) => [a.employee_id, a]));

  const results = [];

  for (const emp of employees) {
    const compScoreMap = storedScores.get(emp.id) ?? new Map<number, number>();

    // Domain scores = avg of scored competencies, weighted by grade
    const domainScores = buildDomainScores(compScoreMap, allCompetencies, domainNames, emp.department_id);
    const overall_score = Number((weightedOverall(domainScores, domainWeightMap.get(emp.target_grade_id)) * 100).toFixed(1));

    const thresholds = getGradeThresholdMap(gradeThresholds, emp.department_id, emp.target_grade_id);
    const thresholdMap = buildCompetencyThresholdMap(allCompetencies, thresholds);
    const {
      averageThreshold: avg_threshold,
      thresholdCount: threshold_count,
      meetsCount: meets_count,
      promotionReady: promotion_ready,
    } = buildThresholdStats(allCompetencies, compScoreMap, thresholdMap);

    const cefrEval = evaluateEmployeeCefr(emp.target_grade?.level ?? 2, cefrMap.get(emp.id));

    results.push({
      ...buildReportEmployeeSummary(emp),
      overall_score,
      avg_threshold,
      meets_count,
      total_competencies: threshold_count,   // only competencies with defined thresholds for this target grade
      promotion_ready,
      cefr_level: cefrEval.cefrLevel,
      cefr_expected: cefrEval.cefrExpected,
      is_cefr_gated: cefrEval.isCefrGated,
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
    const overall_score = Number((weightedOverall(domain_scores, domainWeightMap.get(emp.target_grade_id)) * 100).toFixed(1));

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

// ── 8. Executive Summary & Org Health Report ─────────────────────────────────

export async function getExecutiveSummaryReport(userId: number, managerId: number, role: RoleCode) {
  logger.info({ managerId, role }, 'Running Executive Summary Report');

  const employees = await getEmployeesForManager(userId, managerId, role);
  const employeeIds = employees.map((e) => e.id);

  const { allCompetencies, domainNames } = await loadReportSkillContext();
  const targetGradeIds = getReportTargetGradeIds(employees);
  const departmentIds = getReportDepartmentIds(employees);
  const matrixMap = await loadGradeThresholds(departmentIds, targetGradeIds);
  const domainWeightMap = await loadDomainWeights(targetGradeIds);
  const storedScores = await getStoredCompScores(employeeIds);

  let totalTechScoreSum = 0;
  let totalTechThresholdSum = 0;
  let promotionReadyCount = 0;
  let cefrReadyCount = 0;

  const deptMap = new Map<string, { count: number; techScoreSum: number; techThresholdSum: number; cefrReadyCount: number }>();

  // Query latest CEFR assessments for all employees
  const cefrAssessments = await db.commAssessment.findMany({
    where: { employee_id: { in: employeeIds }, status: 'approved' },
    orderBy: { assessed_at: 'desc' },
    distinct: ['employee_id'],
    include: { ratings: true },
  });
  const cefrMap = new Map(cefrAssessments.map((a) => [a.employee_id, a]));

  let cefrAssessedCount = 0;
  let cefrCurrentReadyCount = 0;

  for (const emp of employees) {
    const compScoreMap = storedScores.get(emp.id) ?? new Map<number, number>();
    const domainScores = buildDomainScores(compScoreMap, allCompetencies, domainNames, emp.department_id);
    const finalTechScore = Number((weightedOverall(domainScores, domainWeightMap.get(emp.target_grade_id)) * 100).toFixed(1));

    const thresholds = getGradeThresholdMap(matrixMap, emp.department_id, emp.target_grade_id);
    const competency_gaps = allCompetencies.map((c) => buildCompetencyGapDetail(c, compScoreMap, thresholds, { departmentId: emp.department_id, fallbackDomain: c.domain }));
    const domain_gaps = buildDomainGapSummary(competency_gaps, domainNames);
    const thresholdRecord: Record<string, number> = Object.fromEntries(
      Object.entries(domain_gaps).filter(([, d]) => d.threshold > 0).map(([k, d]) => [k, d.threshold])
    );
    const finalTechThreshold = Number((weightedOverall(thresholdRecord, domainWeightMap.get(emp.target_grade_id)) * 100).toFixed(1));

    totalTechScoreSum += finalTechScore;
    totalTechThresholdSum += finalTechThreshold;

    const cefrAssessment = cefrMap.get(emp.id);
    if (cefrAssessment) {
      cefrAssessedCount++;
      const currentGradeEval = evaluateEmployeeCefr(emp.current_grade?.level ?? 2, cefrAssessment);
      if (currentGradeEval.isCefrReady) {
        cefrCurrentReadyCount++;
      }
    }

    const cefrEval = evaluateEmployeeCefr(emp.target_grade?.level ?? 2, cefrAssessment);
    const isCefrReady = cefrEval.isCefrReady;
    if (isCefrReady) cefrReadyCount++;

    if (finalTechScore >= finalTechThreshold && isCefrReady) {
      promotionReadyCount++;
    }

    const deptName = emp.department ?? 'General';
    const deptStats = deptMap.get(deptName) ?? { count: 0, techScoreSum: 0, techThresholdSum: 0, cefrReadyCount: 0 };
    deptStats.count += 1;
    deptStats.techScoreSum += finalTechScore;
    deptStats.techThresholdSum += finalTechThreshold;
    if (isCefrReady) deptStats.cefrReadyCount += 1;
    deptMap.set(deptName, deptStats);
  }

  const empCount = employees.length || 1;
  const overallOrgScore = Number((totalTechScoreSum / empCount).toFixed(1));
  const expectedOrgScore = Number((totalTechThresholdSum / empCount).toFixed(1));
  const cefrReadyRate = Number(((cefrReadyCount / empCount) * 100).toFixed(1));
  const cefrCurrentReadyRate = cefrAssessedCount > 0
    ? Number(((cefrCurrentReadyCount / cefrAssessedCount) * 100).toFixed(1))
    : 0;

  const departmentBreakdown = Array.from(deptMap.entries()).map(([department, stats]) => {
    const avgTechScore = Number((stats.techScoreSum / (stats.count || 1)).toFixed(1));
    const expectedTechScore = Number((stats.techThresholdSum / (stats.count || 1)).toFixed(1));
    const cefrReadyRate = Number(((stats.cefrReadyCount / (stats.count || 1)) * 100).toFixed(1));
    const expectedCefrReadyRate = 100.0;
    const techGap = Number((avgTechScore - expectedTechScore).toFixed(1));
    const cefrGap = Number((cefrReadyRate - expectedCefrReadyRate).toFixed(1));

    return {
      department,
      headcount: stats.count,
      avgTechScore,
      expectedTechScore,
      cefrReadyRate,
      expectedCefrReadyRate,
      techGap,
      cefrGap,
    };
  });

  return {
    kpis: {
      totalEmployees: employees.length,
      overallOrgScore,
      expectedOrgScore,
      cefrReadyRate,
      expectedCefrRate: 100.0,
      cefrAssessedCount,
      cefrPendingCount: employees.length - cefrAssessedCount,
      cefrCurrentReadyCount,
      cefrCurrentReadyRate,
      promotionReadyCount,
    },
    departmentBreakdown,
  };
}

// ── 9. Combined Talent Matrix (Technical + CEFR Communication) ─────────────

export async function getCombinedTalentMatrixReport(userId: number, managerId: number, role: RoleCode) {
  logger.info({ managerId, role }, 'Running Combined Talent Matrix Report');

  const employees = await getEmployeesForManager(userId, managerId, role);
  const employeeIds = employees.map((e) => e.id);

  const { allCompetencies, domainNames } = await loadReportSkillContext();
  const targetGradeIds = getReportTargetGradeIds(employees);
  const domainWeightMap = await loadDomainWeights(targetGradeIds);
  const storedScores = await getStoredCompScores(employeeIds);

  const cefrAssessments = await db.commAssessment.findMany({
    where: { employee_id: { in: employeeIds }, status: 'approved' },
    orderBy: { assessed_at: 'desc' },
    distinct: ['employee_id'],
    include: { ratings: true },
  });
  const cefrMap = new Map(cefrAssessments.map((a) => [a.employee_id, a]));

  const rows = [];

  for (const emp of employees) {
    const compScoreMap = storedScores.get(emp.id) ?? new Map<number, number>();
    const domain_scores = buildDomainScores(compScoreMap, allCompetencies, domainNames, emp.department_id);
    const techScore = Number((weightedOverall(domain_scores, domainWeightMap.get(emp.target_grade_id)) * 100).toFixed(1));

    const cefrEval = evaluateEmployeeCefr(emp.target_grade?.level ?? 2, cefrMap.get(emp.id));
    const cefrLevel = cefrEval.cefrLevel;
    const cefrExpected = cefrEval.cefrExpected;
    const isCefrGated = cefrEval.isCefrGated;

    let overallStatus: 'READY' | 'GATED' | 'BELOW' = 'BELOW';
    if (techScore >= 80 && !isCefrGated) {
      overallStatus = 'READY';
    } else if (techScore >= 80 && isCefrGated) {
      overallStatus = 'GATED';
    }

    rows.push({
      ...buildReportEmployeeSummary(emp),
      techScore: Number(techScore.toFixed(1)),
      cefrLevel,
      cefrExpected,
      isCefrGated,
      overallStatus,
      domain_scores,
    });
  }

  rows.sort((a, b) => b.techScore - a.techScore);
  return { employees: rows, domains: domainNames };
}

// ── 10. Multi-Year YoY Growth Report ─────────────────────────────────────────

export async function getMultiYearYoYGrowthReport(userId: number, managerId: number, role: RoleCode) {
  logger.info({ managerId, role }, 'Running Multi-Year YoY Growth Report');

  const periods = await db.appraisalPeriod.findMany({
    orderBy: { calendar_year: 'asc' },
  });

  const employees = await getEmployeesForManager(userId, managerId, role);
  const employeeIds = employees.map((e) => e.id);

  const { allCompetencies, domainNames } = await loadReportSkillContext();

  // Query approved skill assessments grouped by employee and appraisal_period_id
  const periodAssessments = await db.skillAssessment.findMany({
    where: {
      employee_id: { in: employeeIds },
      status: 'approved',
      appraisal_period_id: { not: null },
    },
    select: {
      employee_id: true,
      appraisal_period_id: true,
      score: true,
      technology: {
        select: {
          competency_id: true,
        },
      },
    },
  });

  // Map: [empId, periodId] => Map<competencyId, score>
  const empPeriodCompScores = new Map<string, Map<number, number>>();
  for (const pa of periodAssessments) {
    if (!pa.appraisal_period_id || !pa.technology?.competency_id) continue;
    const key = `${pa.employee_id}:${pa.appraisal_period_id}`;
    if (!empPeriodCompScores.has(key)) {
      empPeriodCompScores.set(key, new Map<number, number>());
    }
    const compMap = empPeriodCompScores.get(key)!;
    const compId = pa.technology.competency_id;
    const currentScore = compMap.get(compId) ?? 0;
    compMap.set(compId, currentScore + Number(pa.score ?? 0));
  }

  const storedScores = await getStoredCompScores(employeeIds);

  // Identify periods that actually contain stored assessment data
  const periodHasDataMap = new Map<number, boolean>();
  for (const p of periods) {
    const hasDbAssessments = periodAssessments.some((pa) => pa.appraisal_period_id === p.id);
    const hasStoredScores = p.is_active && Array.from(storedScores.values()).some((map) => map.size > 0);
    periodHasDataMap.set(p.id, hasDbAssessments || hasStoredScores);
  }

  // Filter periods to only those with authentic database data
  const activePeriodsWithData = periods.filter((p) => periodHasDataMap.get(p.id));
  const targetPeriods = activePeriodsWithData.length > 0 ? activePeriodsWithData : periods;

  const results = employees.map((emp) => {
    const periodScores: Record<string, number | null> = {};

    targetPeriods.forEach((p) => {
      const key = `${emp.id}:${p.id}`;
      let compMap = empPeriodCompScores.get(key);
      if (!compMap || compMap.size === 0) {
        if (p.is_active) {
          compMap = storedScores.get(emp.id);
        }
      }

      if (compMap && compMap.size > 0) {
        const domain_scores = buildDomainScores(compMap, allCompetencies, domainNames, emp.department_id);
        const score = weightedOverall(domain_scores, undefined);
        periodScores[p.code] = Number(score.toFixed(1));
      } else {
        periodScores[p.code] = null;
      }
    });

    const currentScoreMap = storedScores.get(emp.id) ?? new Map<number, number>();
    const currentDomainScores = buildDomainScores(currentScoreMap, allCompetencies, domainNames, emp.department_id);
    const currentScore = weightedOverall(currentDomainScores, undefined);

    return {
      ...buildReportEmployeeSummary(emp),
      currentScore: Number(currentScore.toFixed(1)),
      periodScores,
    };
  });

  return { periods: targetPeriods.map((p) => p.code), employees: results };
}

