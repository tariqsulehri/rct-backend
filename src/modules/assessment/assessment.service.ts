import { db } from '../../config/database';
import logger from '../../config/logger';
import {
  CreateSkillAssessmentRequest,
  UpdateSkillAssessmentRequest,
  ApproveSkillAssessmentRequest,
  SkillAssessmentResponse,
  TeamMemberResponse,
} from './assessment.schema';
import {
  computeAssessmentScore,
  computeCompetencyScore,
  DEFAULT_FORMULA_WEIGHTS,
  FormulaWeights,
} from '../../scoring/scoring.engine';

// ─── Synchronous Scoring ─────────────────────────────────────────────────────
// Recomputes CompetencyScore for every competency touched by this employee's
// assessments. Called after every create/update/approval so reports are fresh
// immediately after assessment changes.

// ── Department-aware formula weights ─────────────────────────────────────────

async function getDeptFormulaWeights(employeeId: number): Promise<FormulaWeights> {
  try {
    // Missing or partially configured departments fall back to the global
    // weights so assessment writes are never blocked by config setup.
    const emp = await db.employee.findUnique({
      where: { id: employeeId },
      select: { department_id: true },
    });
    if (!emp?.department_id) return DEFAULT_FORMULA_WEIGHTS;
    const cfg = await db.departmentConfig.findUnique({
      where: { department_id: emp.department_id },
    });
    if (!cfg) return DEFAULT_FORMULA_WEIGHTS;
    return { primary: cfg.primary_weight, secondary: cfg.secondary_weight, tertiary: cfg.tertiary_weight };
  } catch {
    return DEFAULT_FORMULA_WEIGHTS;
  }
}

async function recomputeScoresForEmployee(employeeId: number): Promise<void> {
  try {
    // Fetch department formula weights once for all competencies
    const weights = await getDeptFormulaWeights(employeeId);

    // 1. Find every competency that has at least one technology assessed
    const assessed = await db.skillAssessment.findMany({
      where: { employee_id: employeeId },
      include: { technology: { select: { competency_id: true } } },
    });

    const competencyIds = [...new Set(assessed.map((a) => a.technology.competency_id))];

    // 2. Also recompute competencies with no remaining assessments (score → null)
    const existingScores = await db.competencyScore.findMany({
      where: { employee_id: employeeId },
      select: { competency_id: true },
    });
    const allCompetencyIds = [
      ...new Set([...competencyIds, ...existingScores.map((s) => s.competency_id)]),
    ];

    for (const competencyId of allCompetencyIds) {
      await recomputeOneCompetency(employeeId, competencyId, weights);
    }
  } catch (err) {
    logger.error({ err, employeeId }, 'recomputeScoresForEmployee failed');
  }
}

async function recomputeOneCompetency(
  employeeId: number,
  competencyId: number,
  weights: FormulaWeights = DEFAULT_FORMULA_WEIGHTS,
): Promise<void> {
  // All technologies for this competency
  const technologies = await db.technology.findMany({
    where: { competency_id: competencyId },
    select: { id: true },
  });

  const techIds = technologies.map((t) => t.id);

  // Only approved assessments count toward the score
  const assessments = await db.skillAssessment.findMany({
    where: { employee_id: employeeId, technology_id: { in: techIds }, status: 'approved' },
  });

  if (assessments.length === 0) {
    await db.competencyScore.upsert({
      where: { employee_id_competency_id: { employee_id: employeeId, competency_id: competencyId } },
      create: { employee_id: employeeId, competency_id: competencyId, score: null, level_label: null, star_rating: null },
      update: { score: null, level_label: null, star_rating: null },
    });
    return;
  }

  const { score, starRating, levelLabel } = computeCompetencyScore(
    assessments.map((assessment) => ({
      type: assessment.type,
      projects: assessment.projects,
      level: assessment.level,
      storedScore: assessment.score,
    })),
    weights,
  );

  await db.competencyScore.upsert({
    where: { employee_id_competency_id: { employee_id: employeeId, competency_id: competencyId } },
    create: { employee_id: employeeId, competency_id: competencyId, score, level_label: levelLabel, star_rating: starRating },
    update: { score, level_label: levelLabel, star_rating: starRating },
  });

  logger.debug({ employeeId, competencyId, score, starRating, levelLabel, weights }, 'Competency score recomputed');
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
      const status = isEngineer ? 'pending' : 'approved';

      const weights = await getDeptFormulaWeights(empInternalId);
      const level = request.level ?? 'Unset';
      const assessmentScore = computeAssessmentScore(request.type, request.projects, level, weights);

      const assessment = await db.skillAssessment.upsert({
        where: {
          employee_id_technology_id: {
            employee_id: empInternalId,
            technology_id: request.technology_id,
          },
        },
        create: {
          employee_id: empInternalId,
          technology_id: request.technology_id,
          type: request.type,
          projects: request.projects,
          level,
          score: assessmentScore,
          status,
          assessed_by: assessedByEmployeeId,
        },
        update: {
          type: request.type,
          projects: request.projects,
          level,
          score: assessmentScore,
          assessed_by: assessedByEmployeeId,
        },
      });

      logger.info({ assessmentId: assessment.id, empCode: request.employee_id }, 'Skill assessment saved');

      await recomputeScoresForEmployee(empInternalId);

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
      const current = await db.skillAssessment.findUnique({ where: { id } });
      if (!current) throw Object.assign(new Error('Assessment not found'), { statusCode: 404 });

      const newType = request.type ?? current.type;
      const newProjects = request.projects ?? current.projects;
      const newLevel = request.level ?? current.level;
      const weights = await getDeptFormulaWeights(current.employee_id);
      const assessmentScore = computeAssessmentScore(newType, newProjects, newLevel, weights);

      const assessment = await db.skillAssessment.update({
        where: { id },
        data: {
          type: newType,
          projects: newProjects,
          level: newLevel,
          score: assessmentScore,
          assessed_by: assessedByEmployeeId,
        },
      });

      logger.info({ assessmentId: id }, 'Skill assessment updated');

      await recomputeScoresForEmployee(assessment.employee_id);

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
      const current = await db.skillAssessment.findUnique({ where: { id } });
      if (!current) throw Object.assign(new Error('Assessment not found'), { statusCode: 404 });

      const newType = request.type ?? current.type;
      const newProjects = request.projects ?? current.projects;
      const newLevel = request.level ?? current.level;
      const weights = await getDeptFormulaWeights(current.employee_id);
      const assessmentScore = computeAssessmentScore(newType, newProjects, newLevel, weights);

      const assessment = await db.skillAssessment.update({
        where: { id },
        data: {
          status: 'approved',
          assessed_by: approvedByEmployeeId,
          type: newType,
          level: newLevel,
          projects: newProjects,
          score: assessmentScore,
        },
      });

      logger.info({ assessmentId: id, approvedByEmployeeId }, 'Skill assessment approved');

      await recomputeScoresForEmployee(assessment.employee_id);

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

  async deleteSkillAssessment(id: number, requestingEmployeeId: number): Promise<void> {
    try {
      const assessment = await db.skillAssessment.findUnique({ where: { id } });
      if (!assessment) throw new Error('Assessment not found');

      await db.skillAssessment.delete({ where: { id } });

      logger.info({ assessmentId: id }, 'Skill assessment deleted');

      // Recompute scores after deletion
      await recomputeScoresForEmployee(assessment.employee_id);
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
