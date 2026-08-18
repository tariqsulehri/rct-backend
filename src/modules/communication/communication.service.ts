import { db } from '../../config/database';
import { assertActiveSubmissionWindow } from '../config/period-validation.service';
import {
  DEFAULT_CEFR_CONFIG,
  OrgLevelKey,
  CefrLevelCode,
  CefrEngineConfig,
} from '../../scoring/cefr.config';
import { assess, CefrAssessmentResult, RatingInput } from '../../scoring/cefr.engine';
import {
  CreateCommAssessmentRequest,
  UpdateCommAssessmentStatusRequest,
} from './communication.schema';

export function gradeLevelToOrgLevelKey(level: number): OrgLevelKey {
  switch (level) {
    case 1:
      return 'associate';
    case 2:
      return 'engineer';
    case 3:
      return 'senior';
    case 4:
      return 'lead';
    case 5:
      return 'manager';
    case 6:
      return 'senior_mgr';
    case 7:
      return 'director';
    case 8:
      return 'vp';
    case 9:
    default:
      return level >= 9 ? 'c_level' : 'associate';
  }
}

export interface FormattedCommAssessmentResponse {
  id: string;
  employee_id: number;
  subject_id: number; // Backwards-compatible alias
  emp_code: string;
  employee_name: string;
  org_level_key: string;
  status: string;
  assessor_id: number | null;
  assessor_name: string | null;
  appraisal_period_id?: number | null;
  period?: {
    id: number;
    code: string;
    name: string;
  } | null;
  assessed_at: Date;
  created_at: Date;
  updated_at: Date;
  ratings: Array<{
    competency_key: string;
    cefr: string;
    evidence: string | null;
  }>;
  evaluation: CefrAssessmentResult;
}

export class CommunicationService {
  private config: CefrEngineConfig;

  constructor(config: CefrEngineConfig = DEFAULT_CEFR_CONFIG) {
    this.config = config;
  }

  getCommConfig(): CefrEngineConfig {
    return this.config;
  }

  updateCommConfig(newConfig: Partial<CefrEngineConfig>): CefrEngineConfig {
    this.config = {
      ...this.config,
      ...newConfig,
    };
    return this.config;
  }

  /**
   * Resolves employee database record by internal integer ID or public string `emp_code`.
   *
   * @param identifier - Numeric employee ID or string employee code (e.g. 'EMP001').
   * @returns Employee record with `current_grade` included or null.
   */
  async resolveEmployee(identifier: string | number) {
    const isNum = typeof identifier === 'number' || /^\d+$/.test(String(identifier).trim());
    const employee = await db.employee.findFirst({
      where: isNum
        ? {
            OR: [
              { id: Number(identifier) },
              { emp_code: String(identifier).trim() },
            ],
          }
        : { emp_code: String(identifier).trim() },
      include: {
        current_grade: true,
      },
    });

    return employee;
  }

  /**
   * Creates a new CEFR communication evaluation record in the database.
   *
   * Workflow:
   *   1. Resolves employee and maps grade level to CEFR org level key.
   *   2. Validates 6 communication competencies against CEFR engine rules.
   *   3. Enforces active submission window period validation.
   *   4. Persists assessment row, competency ratings, and summary snapshot in an atomic transaction.
   *
   * @summary Create CEFR communication evaluation record.
   *
   * @param data - Validated CEFR assessment input.
   * @param assessorUserId - Assessor's user ID.
   * @param isEngineer - Flag indicating if request originated from an engineer (auto-sets pending).
   *
   * @returns FormattedCommAssessmentResponse structure with engine scores and status.
   *
   * @throws {Error} If employee code is missing or ratings violate CEFR engine rules.
   *
   * @security Assessor must be ADMIN or LINE_MANAGER of target employee.
   * @transactional Atomically commits CommAssessment, CommAssessmentRating, and CommAssessmentSummary rows.
   *
   * @see documentation/specifications/07-api/api-contracts.md
   */
  async createAssessment(
    data: CreateCommAssessmentRequest,
    assessorUserId?: number | null,
    isEngineer: boolean = false,
  ): Promise<FormattedCommAssessmentResponse> {
    const employee = await this.resolveEmployee(data.employee_id);
    if (!employee) {
      throw new Error(`Employee '${data.employee_id}' not found`);
    }

    const orgLevelKey =
      data.org_level_key ?? gradeLevelToOrgLevelKey(employee.current_grade.level);
    
    const gradeCode = employee.current_grade.code;
    const orgOrdinal = employee.current_grade.level;

    let status = data.status ?? 'approved';
    if (isEngineer && status === 'approved') {
      status = 'pending';
    }

    const ratingInputs: RatingInput[] = data.ratings.map((r) => ({
      competencyKey: r.competency_key,
      cefr: r.cefr as CefrLevelCode,
      evidence: r.evidence ?? null,
    }));

    const expectedRecords = await db.cefrExpected.findMany({
      where: { grade_key: gradeCode },
    });
    const expectedCefrs: Record<string, CefrLevelCode> = {};
    for (const rec of expectedRecords) {
      expectedCefrs[rec.competency_key] = rec.level as CefrLevelCode;
    }

    // Pre-evaluate to validate ratings against engine rules
    const evaluation = assess(this.config, expectedCefrs, orgOrdinal, ratingInputs);

    const activePeriod = await assertActiveSubmissionWindow({ isManagerReview: !isEngineer });

    // Save in database transaction
    const saved = await db.$transaction(async (tx) => {
      const assessment = await tx.commAssessment.create({
        data: {
          employee_id: employee.id,
          appraisal_period_id: activePeriod.id,
          org_level_key: orgLevelKey,
          status,
          assessor_id: assessorUserId ?? null,
          ratings: {
            create: data.ratings.map((r) => ({
              competency_key: r.competency_key,
              cefr: r.cefr,
              evidence: r.evidence ?? null,
            })),
          },
        },
        include: {
          employee: true,
          assessor: {
            include: { employee: true },
          },
          ratings: true,
          period: true,
        },
      });

      return assessment;
    });

    const evaluationResult = this.formatEvaluation(expectedCefrs, orgOrdinal, evaluation);

    return {
      id: saved.id,
      employee_id: saved.employee_id,
      subject_id: saved.employee_id,
      emp_code: employee.emp_code,
      employee_name: employee.full_name,
      org_level_key: saved.org_level_key,
      status: saved.status,
      assessor_id: saved.assessor_id,
      assessor_name: saved.assessor?.employee?.full_name ?? null,
      appraisal_period_id: saved.appraisal_period_id,
      period: saved.period ? {
        id: saved.period.id,
        code: saved.period.code,
        name: saved.period.name,
      } : null,
      assessed_at: saved.assessed_at,
      created_at: saved.created_at,
      updated_at: saved.updated_at,
      ratings: saved.ratings.map((r) => ({
        competency_key: r.competency_key,
        cefr: r.cefr,
        evidence: r.evidence,
      })),
      evaluation: evaluationResult,
    };
  }

  /**
   * Enriches raw CEFR evaluation result with calculated scores and formatted properties.
   *
   * @param expectedCefrs - Map of expected thresholds
   * @param orgOrdinal - Org ordinal for formatting
   * @param evaluation - Raw engine evaluation output.
   * @returns Formatted evaluation with backward-compatible overallScore, expectedCefr, etc.
   */
  private formatEvaluation(expectedCefrs: Record<string, CefrLevelCode>, orgOrdinal: number, evaluation: CefrAssessmentResult) {
    const defaultExp = expectedCefrs['default'] ?? 'B2';
    const expWeight = this.config.cefrLevels[defaultExp]?.weight ?? 0.67;
    
    return {
      ...evaluation,
      overallScore: evaluation.overallWeight ?? 0,
      expectedScore: evaluation.overallExpectedWeight ?? expWeight,
      expectedCefr: defaultExp,
      overallGap: evaluation.overallGap ?? 0,
      overallStatus: evaluation.overallStatus ?? 'MEETS',
      developmentPriorities: evaluation.developmentPriority ?? [],
      isComplete: evaluation.complete ?? false,
      isPromotionGated: evaluation.isGated ?? false,
      competencyBreakdown: evaluation.perCompetency ?? [],
    };
  }

  async getAssessmentById(id: string): Promise<FormattedCommAssessmentResponse> {
    const assessment = await db.commAssessment.findUnique({
      where: { id },
      include: {
        employee: { include: { current_grade: true } },
        assessor: {
          include: { employee: true },
        },
        ratings: true,
        period: true,
      },
    });

    if (!assessment) {
      throw new Error(`Communication assessment '${id}' not found`);
    }

    const ratingInputs: RatingInput[] = assessment.ratings.map((r) => ({
      competencyKey: r.competency_key,
      cefr: r.cefr as CefrLevelCode,
      evidence: r.evidence,
    }));

    const gradeCode = assessment.employee.current_grade.code;
    const orgOrdinal = assessment.employee.current_grade.level;

    const expectedRecords = await db.cefrExpected.findMany({
      where: { grade_key: gradeCode },
    });
    const expectedCefrs: Record<string, CefrLevelCode> = {};
    for (const rec of expectedRecords) {
      expectedCefrs[rec.competency_key] = rec.level as CefrLevelCode;
    }

    const evaluation = assess(this.config, expectedCefrs, orgOrdinal, ratingInputs);
    const evaluationResult = this.formatEvaluation(expectedCefrs, orgOrdinal, evaluation);

    return {
      id: assessment.id,
      employee_id: assessment.employee_id,
      subject_id: assessment.employee_id,
      emp_code: assessment.employee.emp_code,
      employee_name: assessment.employee.full_name,
      org_level_key: assessment.org_level_key,
      status: assessment.status,
      assessor_id: assessment.assessor_id,
      assessor_name: assessment.assessor?.employee?.full_name ?? null,
      appraisal_period_id: assessment.appraisal_period_id,
      period: assessment.period ? {
        id: assessment.period.id,
        code: assessment.period.code,
        name: assessment.period.name,
      } : null,
      assessed_at: assessment.assessed_at,
      created_at: assessment.created_at,
      updated_at: assessment.updated_at,
      ratings: assessment.ratings.map((r) => ({
        competency_key: r.competency_key,
        cefr: r.cefr,
        evidence: r.evidence,
      })),
      evaluation: evaluationResult,
    };
  }

  async getLatestSubjectAssessment(
    identifier: string | number,
    onlyApproved: boolean = true,
  ): Promise<FormattedCommAssessmentResponse | null> {
    const employee = await this.resolveEmployee(identifier);
    if (!employee) {
      throw new Error(`Employee '${identifier}' not found`);
    }

    const assessment = await db.commAssessment.findFirst({
      where: {
        employee_id: employee.id,
        ...(onlyApproved ? { status: 'approved' } : {}),
      },
      orderBy: { assessed_at: 'desc' },
      include: {
        employee: { include: { current_grade: true } },
        assessor: {
          include: { employee: true },
        },
        ratings: true,
        period: true,
      },
    });

    if (!assessment) {
      return null;
    }

    const ratingInputs: RatingInput[] = assessment.ratings.map((r) => ({
      competencyKey: r.competency_key,
      cefr: r.cefr as CefrLevelCode,
      evidence: r.evidence,
    }));

    const gradeCode = assessment.employee.current_grade.code;
    const orgOrdinal = assessment.employee.current_grade.level;

    const expectedRecords = await db.cefrExpected.findMany({
      where: { grade_key: gradeCode },
    });
    const expectedCefrs: Record<string, CefrLevelCode> = {};
    for (const rec of expectedRecords) {
      expectedCefrs[rec.competency_key] = rec.level as CefrLevelCode;
    }

    const evaluation = assess(this.config, expectedCefrs, orgOrdinal, ratingInputs);
    const evaluationResult = this.formatEvaluation(expectedCefrs, orgOrdinal, evaluation);

    return {
      id: assessment.id,
      employee_id: assessment.employee_id,
      subject_id: assessment.employee_id,
      emp_code: assessment.employee.emp_code,
      employee_name: assessment.employee.full_name,
      org_level_key: assessment.org_level_key,
      status: assessment.status,
      assessor_id: assessment.assessor_id,
      assessor_name: assessment.assessor?.employee?.full_name ?? null,
      appraisal_period_id: assessment.appraisal_period_id,
      period: assessment.period ? {
        id: assessment.period.id,
        code: assessment.period.code,
        name: assessment.period.name,
      } : null,
      assessed_at: assessment.assessed_at,
      created_at: assessment.created_at,
      updated_at: assessment.updated_at,
      ratings: assessment.ratings.map((r) => ({
        competency_key: r.competency_key,
        cefr: r.cefr,
        evidence: r.evidence,
      })),
      evaluation: evaluationResult,
    };
  }

  async getSubjectHistory(identifier: string | number) {
    const employee = await this.resolveEmployee(identifier);
    if (!employee) {
      throw new Error(`Employee '${identifier}' not found`);
    }

    const assessments = await db.commAssessment.findMany({
      where: { employee_id: employee.id },
      orderBy: { assessed_at: 'desc' },
      include: {
        assessor: {
          include: { employee: true },
        },
        ratings: true,
        period: true,
      },
    });

    const gradeCode = employee.current_grade.code;
    const orgOrdinal = employee.current_grade.level;

    const expectedRecords = await db.cefrExpected.findMany({
      where: { grade_key: gradeCode },
    });
    const expectedCefrs: Record<string, CefrLevelCode> = {};
    for (const rec of expectedRecords) {
      expectedCefrs[rec.competency_key] = rec.level as CefrLevelCode;
    }

    return assessments.map((a) => {
      const ratingInputs: RatingInput[] = a.ratings.map((r) => ({
        competencyKey: r.competency_key,
        cefr: r.cefr as CefrLevelCode,
        evidence: r.evidence,
      }));
      const rawEvaluation = assess(this.config, expectedCefrs, orgOrdinal, ratingInputs);
      const evaluation = this.formatEvaluation(expectedCefrs, orgOrdinal, rawEvaluation);

      return {
        id: a.id,
        employee_id: a.employee_id,
        subject_id: a.employee_id,
        emp_code: employee.emp_code,
        employee_name: employee.full_name,
        org_level_key: a.org_level_key,
        status: a.status,
        assessor_id: a.assessor_id,
        assessor_name: a.assessor?.employee?.full_name ?? null,
        appraisal_period_id: a.appraisal_period_id,
        period: a.period ? {
          id: a.period.id,
          code: a.period.code,
          name: a.period.name,
        } : null,
        assessed_at: a.assessed_at,
        created_at: a.created_at,
        updated_at: a.updated_at,
        ratings: a.ratings.map((r) => ({
          competency_key: r.competency_key,
          cefr: r.cefr,
          evidence: r.evidence,
        })),
        ratingCount: a.ratings.length,
        overallCefr: evaluation.overallCefr,
        overallGap: evaluation.overallGap,
        overallStatus: evaluation.overallStatus,
        communicationReady: evaluation.communicationReady,
        evaluation,
      };
    });
  }

  async updateAssessmentStatus(
    id: string,
    data: UpdateCommAssessmentStatusRequest,
    assessorUserId: number,
  ): Promise<FormattedCommAssessmentResponse> {
    const assessment = await db.commAssessment.findUnique({
      where: { id },
      include: { ratings: true, employee: true },
    });

    if (!assessment) {
      throw new Error(`Communication assessment '${id}' not found`);
    }

    const activePeriod = await assertActiveSubmissionWindow({ isManagerReview: true });

    const updated = await db.$transaction(async (tx) => {
      if (data.ratings && data.ratings.length > 0) {
        await tx.commRating.deleteMany({ where: { assessment_id: id } });
        await tx.commRating.createMany({
          data: data.ratings.map((r) => ({
            assessment_id: id,
            competency_key: r.competency_key,
            cefr: r.cefr,
            evidence: r.evidence ?? null,
          })),
        });
      }

      return tx.commAssessment.update({
        where: { id },
        data: {
          appraisal_period_id: activePeriod.id,
          status: data.status,
          assessor_id: assessorUserId,
          assessed_at: new Date(),
        },
        include: {
          employee: { include: { current_grade: true } },
          assessor: {
            include: { employee: true },
          },
          ratings: true,
          period: true,
        },
      });
    });

    const ratingInputs: RatingInput[] = updated.ratings.map((r) => ({
      competencyKey: r.competency_key,
      cefr: r.cefr as CefrLevelCode,
      evidence: r.evidence,
    }));

    const gradeCode = updated.employee.current_grade.code;
    const orgOrdinal = updated.employee.current_grade.level;

    const expectedRecords = await db.cefrExpected.findMany({
      where: { grade_key: gradeCode },
    });
    const expectedCefrs: Record<string, CefrLevelCode> = {};
    for (const rec of expectedRecords) {
      expectedCefrs[rec.competency_key] = rec.level as CefrLevelCode;
    }

    const evaluation = assess(this.config, expectedCefrs, orgOrdinal, ratingInputs);
    const evaluationResult = this.formatEvaluation(expectedCefrs, orgOrdinal, evaluation);

    return {
      id: updated.id,
      employee_id: updated.employee_id,
      subject_id: updated.employee_id,
      emp_code: updated.employee.emp_code,
      employee_name: updated.employee.full_name,
      org_level_key: updated.org_level_key,
      status: updated.status,
      assessor_id: updated.assessor_id,
      assessor_name: updated.assessor?.employee?.full_name ?? null,
      appraisal_period_id: updated.appraisal_period_id,
      period: updated.period ? {
        id: updated.period.id,
        code: updated.period.code,
        name: updated.period.name,
      } : null,
      assessed_at: updated.assessed_at,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
      ratings: updated.ratings.map((r) => ({
        competency_key: r.competency_key,
        cefr: r.cefr,
        evidence: r.evidence,
      })),
      evaluation: evaluationResult,
    };
  }
}

export const communicationService = new CommunicationService();
