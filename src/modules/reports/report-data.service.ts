import { db } from '../../config/database';
import { RoleCode } from '../../types/rbac';
import { accessScopeService } from '../access/access-scope.service';

type ReportGradeEmployee = {
  target_grade_id: number;
};

type ReportDepartmentEmployee = {
  department_id: number | null;
};

export async function loadReportSkillContext() {
  const allCompetencies = await db.competency.findMany({
    include: { competency_domains: { include: { domain: true } } },
  });
  const competencyById = new Map(allCompetencies.map((competency) => [competency.id, competency]));
  const allDomains = await db.skillDomain.findMany({ orderBy: { name: 'asc' } });
  const domainNames = allDomains.map((d) => d.name);

  return { allCompetencies, competencyById, domainNames };
}

export function getReportTargetGradeIds(employees: ReportGradeEmployee[]) {
  return [...new Set(employees.map((e) => e.target_grade_id))];
}

export function getReportDepartmentIds(employees: ReportDepartmentEmployee[]) {
  return [...new Set(employees.map((e) => e.department_id).filter((id): id is number => id != null))];
}

function getGradeThresholdKey(departmentId: number, gradeId: number) {
  return `${departmentId}:${gradeId}`;
}

/**
 * Load stored competency scores for a set of employees.
 * Returns Map<employeeId, Map<competencyId, score>>
 */
export async function getStoredCompScores(
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

export async function loadDomainWeights(
  gradeIds: number[]
): Promise<Map<number, Map<string, number>>> {
  if (gradeIds.length === 0) return new Map();

  const rows = await db.skillDomainGradeWeight.findMany({
    where: { grade_id: { in: gradeIds } },
    select: {
      grade_id: true,
      weight: true,
      domain: { select: { name: true } },
    },
  });

  const result = new Map<number, Map<string, number>>();
  for (const row of rows) {
    if (!result.has(row.grade_id)) result.set(row.grade_id, new Map());
    result.get(row.grade_id)!.set(row.domain.name, row.weight);
  }
  return result;
}

export async function loadGradeThresholds(
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
    const key = getGradeThresholdKey(row.department_id, row.grade_id);
    if (!result.has(key)) result.set(key, new Map());
    result.get(key)!.set(row.competency_id, row.threshold);
  }
  return result;
}

export function getGradeThresholdMap(
  gradeThresholds: Map<string, Map<number, number>>,
  departmentId: number | null | undefined,
  gradeId: number
) {
  return departmentId
    ? gradeThresholds.get(getGradeThresholdKey(departmentId, gradeId)) ?? new Map<number, number>()
    : new Map<number, number>();
}

export async function getAccessibleReportEmployeeIds(
  userId: number,
  managerId: number,
  role: RoleCode
) {
  return accessScopeService.getAccessibleEmployeeIds({
    id: userId,
    employeeId: managerId,
    role,
  });
}

export async function getEmployeesForManager(
  userId: number,
  managerId: number,
  role: RoleCode,
  employeeId?: number
) {
  const accessibleEmployeeIds = await getAccessibleReportEmployeeIds(userId, managerId, role);
  const scopedIds = employeeId
    ? accessibleEmployeeIds.filter((id) => id === employeeId)
    : accessibleEmployeeIds;

  if (scopedIds.length === 0) return [];

  if (employeeId) {
    return db.employee.findMany({
      where: {
        id: { in: scopedIds },
        deleted_at: null,
      },
      include: { current_grade: true, target_grade: true, dept: true },
    });
  }
  return db.employee.findMany({
    where: { id: { in: scopedIds }, deleted_at: null },
    include: { current_grade: true, target_grade: true, dept: true },
  });
}
