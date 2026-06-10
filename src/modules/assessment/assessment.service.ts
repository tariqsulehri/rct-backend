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
  DEFAULT_SCORING_VALUES,
  LEVEL_WEIGHT,
  LevelWeights,
  ProjectCredits,
  ScoringValues,
} from '../../scoring/scoring.engine';

// ─── Synchronous Scoring ─────────────────────────────────────────────────────
// Recomputes CompetencyScore for every competency touched by this employee's
// assessments. Called after every create/update/approval so reports are fresh
// immediately after assessment changes.

// ── Configured assessment type values ────────────────────────────────────────

async function getConfiguredScoringValues(): Promise<ScoringValues> {
  try {
    const configs = await db.assessmentTypeConfig.findMany({
      where: { code: { in: ['Primary', 'Secondary', 'Tertiary'] }, is_active: true },
    });
    const byCode = new Map(configs.map((config) => [config.code, config.weight]));
    return {
      primary: byCode.get('Primary') ?? DEFAULT_SCORING_VALUES.primary,
      secondary: byCode.get('Secondary') ?? DEFAULT_SCORING_VALUES.secondary,
      tertiary: byCode.get('Tertiary') ?? DEFAULT_SCORING_VALUES.tertiary,
    };
  } catch {
    return DEFAULT_SCORING_VALUES;
  }
}

async function getConfiguredLevelWeights(): Promise<LevelWeights> {
  try {
    const configs = await db.assessmentLevelConfig.findMany({ where: { is_active: true } });
    return {
      ...LEVEL_WEIGHT,
      ...Object.fromEntries(configs.map((config) => [config.code, config.weight])),
    };
  } catch {
    return LEVEL_WEIGHT;
  }
}

async function getConfiguredProjectCredits(): Promise<ProjectCredits> {
  try {
    const configs = await db.assessmentProjectConfig.findMany({ where: { is_active: true } });
    return Object.fromEntries(configs.map((config) => [config.project_count, config.credit]));
  } catch {
    return {};
  }
}

async function getScoredAssessmentStatuses(): Promise<string[]> {
  try {
    const configs = await db.assessmentStatusConfig.findMany({
      where: { is_active: true, counts_toward_score: true },
      select: { code: true },
    });
    const statuses = configs.map((config) => config.code);
    return statuses.length > 0 ? statuses : ['approved'];
  } catch {
    return ['approved'];
  }
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

async function recomputeScoresForEmployee(employeeId: number): Promise<void> {
  try {
    // Fetch configured type values once for all competencies.
    const [scoringValues, levelWeights, projectCredits] = await Promise.all([
      getConfiguredScoringValues(),
      getConfiguredLevelWeights(),
      getConfiguredProjectCredits(),
    ]);

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
      await recomputeOneCompetency(employeeId, competencyId, scoringValues, levelWeights, projectCredits);
    }
  } catch (err) {
    logger.error({ err, employeeId }, 'recomputeScoresForEmployee failed');
  }
}

async function recomputeOneCompetency(
  employeeId: number,
  competencyId: number,
  scoringValues: ScoringValues = DEFAULT_SCORING_VALUES,
  levelWeights: LevelWeights = LEVEL_WEIGHT,
  projectCredits: ProjectCredits = {},
): Promise<void> {
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: { department_id: true },
  });
  const departmentId = employee?.department_id ?? null;

  // All technologies for this competency
  const technologies = await db.technology.findMany({
    where: { competency_id: competencyId },
    select: { id: true },
  });

  const techIds = technologies.map((t) => t.id);

  const scoredStatuses = await getScoredAssessmentStatuses();

  // Only approved assessments count toward the score
  const assessments = await db.skillAssessment.findMany({
    where: { employee_id: employeeId, technology_id: { in: techIds }, status: { in: scoredStatuses } },
  });

  if (assessments.length === 0) {
    await db.competencyScore.upsert({
      where: { employee_id_competency_id: { employee_id: employeeId, competency_id: competencyId } },
      create: { employee_id: employeeId, department_id: departmentId, competency_id: competencyId, score: null, level_label: null, star_rating: null },
      update: { department_id: departmentId, score: null, level_label: null, star_rating: null },
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
    scoringValues,
    levelWeights,
    projectCredits,
  );

  await db.competencyScore.upsert({
    where: { employee_id_competency_id: { employee_id: employeeId, competency_id: competencyId } },
    create: { employee_id: employeeId, department_id: departmentId, competency_id: competencyId, score, level_label: levelLabel, star_rating: starRating },
    update: { department_id: departmentId, score, level_label: levelLabel, star_rating: starRating },
  });

  logger.debug({ employeeId, competencyId, score, starRating, levelLabel, scoringValues }, 'Competency score recomputed');
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

      const [scoringValues, levelWeights, projectCredits] = await Promise.all([
        getConfiguredScoringValues(),
        getConfiguredLevelWeights(),
        getConfiguredProjectCredits(),
      ]);
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
      const current = await db.skillAssessment.findUnique({
        where: { id },
        include: { employee: { select: { department_id: true } } },
      });
      if (!current) throw Object.assign(new Error('Assessment not found'), { statusCode: 404 });

      const newType = request.type ?? current.type;
      const newProjects = request.projects ?? current.projects;
      const newLevel = request.level ?? current.level;
      const [scoringValues, levelWeights, projectCredits] = await Promise.all([
        getConfiguredScoringValues(),
        getConfiguredLevelWeights(),
        getConfiguredProjectCredits(),
      ]);
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
      const current = await db.skillAssessment.findUnique({
        where: { id },
        include: { employee: { select: { department_id: true } } },
      });
      if (!current) throw Object.assign(new Error('Assessment not found'), { statusCode: 404 });

      const newType = request.type ?? current.type;
      const newProjects = request.projects ?? current.projects;
      const newLevel = request.level ?? current.level;
      const [scoringValues, levelWeights, projectCredits] = await Promise.all([
        getConfiguredScoringValues(),
        getConfiguredLevelWeights(),
        getConfiguredProjectCredits(),
      ]);
      const assessmentScore = computeAssessmentScore(newType, newProjects, newLevel, scoringValues, levelWeights, projectCredits);
      const refs = await getAssessmentReferenceIds(current.technology_id);

      const assessment = await db.skillAssessment.update({
        where: { id },
        data: {
          department_id: current.employee.department_id,
          domain_id: refs.domainId,
          competency_id: refs.competencyId,
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
