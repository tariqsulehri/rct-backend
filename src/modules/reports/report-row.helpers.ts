import { CompetencyDomainRef, getPrimaryDomain } from '../../scoring/reporting.engine';

type ReportEmployeeSource = {
  id: number;
  emp_code: string;
  full_name: string;
  department: string;
  dept?: { name: string } | null;
  current_grade: {
    code: string;
    title: string;
  };
  target_grade: {
    code: string;
    title: string;
  };
};

type ReportCompetencySource = {
  id: number;
  name: string;
  is_critical: boolean;
  competency_domains: CompetencyDomainRef[];
};

function getReportDepartmentName(employee: ReportEmployeeSource) {
  return employee.dept?.name ?? employee.department;
}

export function buildGapAnalysisEmployeeSummary(employee: ReportEmployeeSource) {
  return {
    id: employee.id,
    emp_code: employee.emp_code,
    full_name: employee.full_name,
    department: getReportDepartmentName(employee),
    current_grade: employee.current_grade.code,
    target_grade: employee.target_grade.code,
  };
}

export function buildReportEmployeeSummary(employee: ReportEmployeeSource) {
  return {
    employee_id: employee.id,
    emp_code: employee.emp_code,
    full_name: employee.full_name,
    department: getReportDepartmentName(employee),
    current_grade: employee.current_grade.code,
    target_grade: employee.target_grade.code,
  };
}

export function buildReportEmployeeSummaryWithGradeTitles(employee: ReportEmployeeSource) {
  return {
    employee_id: employee.id,
    full_name: employee.full_name,
    emp_code: employee.emp_code,
    department: getReportDepartmentName(employee),
    current_grade: employee.current_grade.code,
    current_grade_title: employee.current_grade.title,
    target_grade: employee.target_grade.code,
    target_grade_title: employee.target_grade.title,
  };
}

export function buildOrderedReportCompetencies(competencies: ReportCompetencySource[]) {
  return competencies
    .map((competency) => {
      const primaryDomain = getPrimaryDomain(competency.competency_domains);
      return {
        id: competency.id,
        name: competency.name,
        domain: primaryDomain.name,
        is_critical: competency.is_critical,
      };
    })
    .sort((a, b) => a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name));
}
