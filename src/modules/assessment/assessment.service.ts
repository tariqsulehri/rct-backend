import { db } from '../../config/database';
import logger from '../../config/logger';
import {
  CreateSkillAssessmentRequest,
  UpdateSkillAssessmentRequest,
  ApproveSkillAssessmentRequest,
  SkillAssessmentResponse,
  TeamMemberResponse,
  PendingApprovalResponse,
} from './assessment.schema';
import {
  computeAssessmentScore,
} from '../../scoring/scoring.engine';
import { createScoringConfigService } from '../../scoring/scoring-config.service';
import { createScoreRecalculationService } from '../../scoring/score-recalculation.service';

const scoringConfigService = createScoringConfigService(db);
const scoreRecalculationService = createScoreRecalculationService(db, {
  scoringConfigService,
  logger,
  swallowErrors: true,
});

// ─── Synchronous Scoring ─────────────────────────────────────────────────────
// Recomputes CompetencyScore for every competency touched by this employee's
// assessments. Called after every create/update/approval so reports are fresh
// immediately after assessment changes.

async function getInitialAssessmentStatus(isEngineer: boolean): Promise<string> {
  return isEngineer
    ? scoringConfigService.getConfiguredStatusCode('pending', { counts_toward_score: false, is_terminal: false }, 'pending')
    : scoringConfigService.getConfiguredStatusCode('approved', { counts_toward_score: true, is_terminal: true }, 'approved');
}

async function getApprovalStatus(): Promise<string> {
  return scoringConfigService.getConfiguredStatusCode('approved', { counts_toward_score: true, is_terminal: true }, 'approved');
}

async function getAssessmentReferenceIds(
  technologyId: number,
): Promise<{ competencyId: number | null; domainId: number | null }> {
  const technology = await db.technology.findUnique({
    where: { id: technologyId },
    select: { competency_id: true },
  });

  if (!technology) return { competencyId: null, domainId: null };

  const domainMap = await db.competencyDomainMap.findFirst({
    where: { competency_id: technology.competency_id },
    orderBy: [{ is_primary: 'desc' }, { id: 'asc' }],
    select: { domain_id: true },
  });

  return {
    competencyId: technology.competency_id,
    domainId: domainMap?.domain_id ?? null,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const assessmentService = {
  /** Lightweight lookup used by the controller for ownership checks. */
  async findAssessmentById(id: number) {
    return db.skillAssessment.findUnique({
      where: { id },
      select: { id: true, employee_id: true },
    });
  },

  async createSkillAssessment(
    request: CreateSkillAssessmentRequest,
    assessedByEmployeeId: number,   // Employee.id (internal) of the assessor
    role: string = 'MANAGER',
  ): Promise<SkillAssessmentResponse & { computed?: { score: number; starRating: number; levelLabel: string } }> {
    try {
      // Resolve emp_code → internal Employee.id
      const employee = await db.employee.findUnique({ where: { emp_code: request.employee_id } });
      if (!employee) throw Object.assign(new Error(`Employee emp_code '${request.employee_id}' not found`), { statusCode: 404 });
      const empInternalId = employee.id;

      const isEngineer = role === 'ENGINEER';
      const status = await getInitialAssessmentStatus(isEngineer);

      const { scoringValues, levelWeights, projectCredits } = await scoringConfigService.getAssessmentScoreConfig();
      const level = request.level ?? 'Unset';
      const assessmentScore = computeAssessmentScore(request.type, request.projects, level, scoringValues, levelWeights, projectCredits);
      const refs = await getAssessmentReferenceIds(request.technology_id);

      const assessment = await db.skillAssessment.upsert({
        where: {
          employee_id_technology_id: {
            employee_id: empInternalId,
            technology_id: request.technology_id,
          },
        },
        create: {
          employee_id: empInternalId,
          department_id: employee.department_id,
          domain_id: refs.domainId,
          competency_id: refs.competencyId,
          technology_id: request.technology_id,
          type: request.type,
          projects: request.projects,
          level,
          score: assessmentScore,
          status,
          assessed_by: assessedByEmployeeId,
        },
        update: {
          department_id: employee.department_id,
          domain_id: refs.domainId,
          competency_id: refs.competencyId,
          type: request.type,
          projects: request.projects,
          level,
          score: assessmentScore,
          assessed_by: assessedByEmployeeId,
        },
      });

      logger.info({ assessmentId: assessment.id, empCode: request.employee_id }, 'Skill assessment saved');

      await scoreRecalculationService.recomputeScoresForEmployee(empInternalId);

      const tech = await db.technology.findUnique({
        where: { id: request.technology_id },
        select: { competency_id: true },
      });

      let computed: { score: number; starRating: number; levelLabel: string } | undefined;
      if (tech) {
        const cs = await db.competencyScore.findUnique({
          where: { employee_id_competency_id: { employee_id: empInternalId, competency_id: tech.competency_id } },
        });
        if (cs?.score != null) {
          computed = { score: cs.score, starRating: cs.star_rating ?? 1, levelLabel: cs.level_label ?? 'L0 Developing' };
        }
      }

      // API clients work with emp_code, while scoring tables use internal ids.
      const assessor = await db.employee.findUnique({ where: { id: assessedByEmployeeId }, select: { emp_code: true } });

      return {
        id: assessment.id,
        employee_id: employee.emp_code,
        technology_id: assessment.technology_id,
        type: assessment.type,
        projects: assessment.projects,
        level: assessment.level,
        status: assessment.status,
        assessed_by: assessor?.emp_code ?? String(assessedByEmployeeId),
        assessed_at: assessment.assessed_at.toISOString(),
        updated_at: assessment.updated_at.toISOString(),
        computed,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to create skill assessment');
      throw error;
    }
  },

  async updateSkillAssessment(
    id: number,
    request: UpdateSkillAssessmentRequest,
    assessedByEmployeeId: number,   // Employee.id (internal)
  ): Promise<SkillAssessmentResponse> {
    try {
      // Read current values so we can compute score even if only some fields change
      const current = await db.skillAssessment.findUnique({
        where: { id },
        include: { employee: { select: { department_id: true } } },
      });
      if (!current) throw Object.assign(new Error('Assessment not found'), { statusCode: 404 });

      const newType = request.type ?? current.type;
      const newProjects = request.projects ?? current.projects;
      const newLevel = request.level ?? current.level;
      const { scoringValues, levelWeights, projectCredits } = await scoringConfigService.getAssessmentScoreConfig();
      const assessmentScore = computeAssessmentScore(newType, newProjects, newLevel, scoringValues, levelWeights, projectCredits);
      const refs = await getAssessmentReferenceIds(current.technology_id);

      const assessment = await db.skillAssessment.update({
        where: { id },
        data: {
          department_id: current.employee.department_id,
          domain_id: refs.domainId,
          competency_id: refs.competencyId,
          type: newType,
          projects: newProjects,
          level: newLevel,
          score: assessmentScore,
          assessed_by: assessedByEmployeeId,
        },
      });

      logger.info({ assessmentId: id }, 'Skill assessment updated');

      await scoreRecalculationService.recomputeScoresForEmployee(assessment.employee_id);

      const [emp, assessor] = await Promise.all([
        db.employee.findUnique({ where: { id: assessment.employee_id }, select: { emp_code: true } }),
        db.employee.findUnique({ where: { id: assessedByEmployeeId }, select: { emp_code: true } }),
      ]);

      return {
        id: assessment.id,
        employee_id: emp?.emp_code ?? String(assessment.employee_id),
        technology_id: assessment.technology_id,
        type: assessment.type,
        projects: assessment.projects,
        level: assessment.level,
        status: assessment.status,
        assessed_by: assessor?.emp_code ?? String(assessedByEmployeeId),
        assessed_at: assessment.assessed_at.toISOString(),
        updated_at: assessment.updated_at.toISOString(),
      };
    } catch (error) {
      logger.error({ error, id }, 'Failed to update skill assessment');
      throw error;
    }
  },

  async approveSkillAssessment(
    id: number,
    approvedByEmployeeId: number,   // Employee.id (internal)
    request: ApproveSkillAssessmentRequest,
  ): Promise<SkillAssessmentResponse> {
    try {
      const current = await db.skillAssessment.findUnique({
        where: { id },
        include: { employee: { select: { department_id: true } } },
      });
      if (!current) throw Object.assign(new Error('Assessment not found'), { statusCode: 404 });

      const newType = request.type ?? current.type;
      const newProjects = request.projects ?? current.projects;
      const newLevel = request.level ?? current.level;
      const { scoringValues, levelWeights, projectCredits } = await scoringConfigService.getAssessmentScoreConfig();
      const assessmentScore = computeAssessmentScore(newType, newProjects, newLevel, scoringValues, levelWeights, projectCredits);
      const refs = await getAssessmentReferenceIds(current.technology_id);

      const assessment = await db.skillAssessment.update({
        where: { id },
        data: {
          department_id: current.employee.department_id,
          domain_id: refs.domainId,
          competency_id: refs.competencyId,
          status: await getApprovalStatus(),
          assessed_by: approvedByEmployeeId,
          type: newType,
          level: newLevel,
          projects: newProjects,
          score: assessmentScore,
        },
      });

      logger.info({ assessmentId: id, approvedByEmployeeId }, 'Skill assessment approved');

      await scoreRecalculationService.recomputeScoresForEmployee(assessment.employee_id);

      const [emp, assessor] = await Promise.all([
        db.employee.findUnique({ where: { id: assessment.employee_id }, select: { emp_code: true } }),
        db.employee.findUnique({ where: { id: approvedByEmployeeId }, select: { emp_code: true } }),
      ]);

      return {
        id: assessment.id,
        employee_id: emp?.emp_code ?? String(assessment.employee_id),
        technology_id: assessment.technology_id,
        type: assessment.type,
        projects: assessment.projects,
        level: assessment.level,
        status: assessment.status,
        assessed_by: assessor?.emp_code ?? String(approvedByEmployeeId),
        assessed_at: assessment.assessed_at.toISOString(),
        updated_at: assessment.updated_at.toISOString(),
      };
    } catch (error) {
      logger.error({ error, id }, 'Failed to approve skill assessment');
      throw error;
    }
  },

  async getSkillAssessmentsByEmployee(empCode: string): Promise<SkillAssessmentResponse[]> {
    try {
      // Resolve emp_code → internal id
      const employee = await db.employee.findUnique({ where: { emp_code: empCode } });
      if (!employee) throw Object.assign(new Error(`Employee emp_code '${empCode}' not found`), { statusCode: 404 });

      const assessments = await db.skillAssessment.findMany({
        where: { employee_id: employee.id },
        orderBy: { assessed_at: 'desc' },
      });

      // Batch-resolve assessor emp_codes
      const assessorIds = [...new Set(assessments.map((a) => a.assessed_by))];
      const assessors = await db.employee.findMany({
        where: { id: { in: assessorIds } },
        select: { id: true, emp_code: true },
      });
      const assessorMap = new Map(assessors.map((e) => [e.id, e.emp_code]));

      return assessments.map((a) => ({
        id: a.id,
        employee_id: empCode,
        technology_id: a.technology_id,
        type: a.type,
        projects: a.projects,
        level: a.level,
        status: a.status,
        assessed_by: assessorMap.get(a.assessed_by) ?? String(a.assessed_by),
        assessed_at: a.assessed_at.toISOString(),
        updated_at: a.updated_at.toISOString(),
      }));
    } catch (error) {
      logger.error({ error, empCode }, 'Failed to fetch employee assessments');
      throw error;
    }
  },

  async getPendingApprovals(employeeIds: number[]): Promise<PendingApprovalResponse[]> {
    try {
      if (employeeIds.length === 0) return [];

      const pendingStatus = await scoringConfigService.getConfiguredStatusCode(
        'pending',
        { counts_toward_score: false, is_terminal: false },
        'pending',
      );

      const assessments = await db.skillAssessment.findMany({
        where: {
          employee_id: { in: employeeIds },
          status: pendingStatus,
          employee: { deleted_at: null },
        },
        include: {
          employee: {
            select: {
              emp_code: true,
              full_name: true,
              department: true,
              current_grade: { select: { code: true } },
              target_grade: { select: { code: true } },
            },
          },
          technology: {
            select: {
              name: true,
              competency: {
                select: {
                  name: true,
                  competency_domains: {
                    include: { domain: { select: { name: true } } },
                  },
                },
              },
            },
          },
          domain: { select: { name: true } },
        },
        orderBy: [{ updated_at: 'asc' }, { id: 'asc' }],
      });

      const assessorIds = [...new Set(assessments.map((assessment) => assessment.assessed_by))];
      const assessors = await db.employee.findMany({
        where: { id: { in: assessorIds } },
        select: { id: true, emp_code: true, full_name: true },
      });
      const assessorMap = new Map(assessors.map((employee) => [employee.id, employee]));

      return assessments.map((assessment) => {
        const assessor = assessorMap.get(assessment.assessed_by);
        const primaryDomain = assessment.technology.competency.competency_domains.find((map) => map.is_primary);
        const fallbackDomain = assessment.technology.competency.competency_domains[0];

        return {
          id: assessment.id,
          employee_id: assessment.employee.emp_code,
          employee_name: assessment.employee.full_name,
          department: assessment.employee.department,
          current_grade: assessment.employee.current_grade.code,
          target_grade: assessment.employee.target_grade.code,
          technology_id: assessment.technology_id,
          technology_name: assessment.technology.name,
          competency_name: assessment.technology.competency.name,
          domain_name: assessment.domain?.name ?? primaryDomain?.domain.name ?? fallbackDomain?.domain.name ?? 'Unknown',
          type: assessment.type,
          projects: assessment.projects,
          level: assessment.level,
          score: Number(assessment.score),
          status: assessment.status,
          submitted_by: assessor ? `${assessor.full_name} (${assessor.emp_code})` : String(assessment.assessed_by),
          submitted_at: assessment.assessed_at.toISOString(),
          updated_at: assessment.updated_at.toISOString(),
        };
      });
    } catch (error) {
      logger.error({ error }, 'Failed to fetch pending approvals');
      throw error;
    }
  },

  async deleteSkillAssessment(id: number, requestingEmployeeId: number): Promise<void> {
    try {
      const assessment = await db.skillAssessment.findUnique({ where: { id } });
      if (!assessment) throw new Error('Assessment not found');

      await db.skillAssessment.delete({ where: { id } });

      logger.info({ assessmentId: id }, 'Skill assessment deleted');

      // Recompute scores after deletion
      await scoreRecalculationService.recomputeScoresForEmployee(assessment.employee_id);
    } catch (error) {
      logger.error({ error, id }, 'Failed to delete skill assessment');
      throw error;
    }
  },

  async getTeamRoster(managerId: number, department?: string): Promise<TeamMemberResponse[]> {
    try {
      const reports = await db.employee.findMany({
        where: {
          manager_id: managerId,
          deleted_at: null,
          ...(department && { department }),
        },
        include: {
          current_grade: { select: { id: true, code: true, title: true, level: true } },
          target_grade: { select: { id: true, code: true, title: true, level: true } },
          skill_assessments: { select: { id: true } },
        },
        orderBy: { full_name: 'asc' },
      });

      return reports.map((emp) => ({
        id: emp.id,
        emp_code: emp.emp_code,
        full_name: emp.full_name,
        department: emp.department,
        email: emp.email,
        current_grade: emp.current_grade,
        target_grade: emp.target_grade,
        skill_assessments_count: emp.skill_assessments.length,
      }));
    } catch (error) {
      logger.error({ error, managerId }, 'Failed to fetch team roster');
      throw error;
    }
  },

  async getEmployeesByIds(employeeIds: number[], department?: string): Promise<TeamMemberResponse[]> {
    try {
      if (employeeIds.length === 0) return [];
      const employees = await db.employee.findMany({
        where: {
          id: { in: employeeIds },
          deleted_at: null,
          ...(department && { department }),
        },
        include: {
          current_grade: { select: { id: true, code: true, title: true, level: true } },
          target_grade: { select: { id: true, code: true, title: true, level: true } },
          skill_assessments: { select: { id: true } },
        },
        orderBy: [{ department: 'asc' }, { full_name: 'asc' }],
      });

      return employees.map((emp) => ({
        id: emp.id,
        emp_code: emp.emp_code,
        full_name: emp.full_name,
        department: emp.department,
        email: emp.email,
        current_grade: emp.current_grade,
        target_grade: emp.target_grade,
        skill_assessments_count: emp.skill_assessments.length,
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to fetch scoped employees');
      throw error;
    }
  },

  async getAllEmployees(department?: string): Promise<TeamMemberResponse[]> {
    try {
      const employees = await db.employee.findMany({
        where: { deleted_at: null, ...(department && { department }) },
        include: {
          current_grade: { select: { id: true, code: true, title: true, level: true } },
          target_grade: { select: { id: true, code: true, title: true, level: true } },
          skill_assessments: { select: { id: true } },
        },
        orderBy: [{ department: 'asc' }, { full_name: 'asc' }],
      });

      return employees.map((emp) => ({
        id: emp.id,
        emp_code: emp.emp_code,
        full_name: emp.full_name,
        department: emp.department,
        email: emp.email,
        current_grade: emp.current_grade,
        target_grade: emp.target_grade,
        skill_assessments_count: emp.skill_assessments.length,
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to fetch all employees');
      throw error;
    }
  },
};
