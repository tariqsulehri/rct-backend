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

    let status = data.status ?? 'approved';
    if (isEngineer && status === 'approved') {
      status = 'pending';
    }

    const ratingInputs: RatingInput[] = data.ratings.map((r) => ({
      competencyKey: r.competency_key,
      cefr: r.cefr as CefrLevelCode,
      evidence: r.evidence ?? null,
    }));

    // Pre-evaluate to validate ratings against engine rules
    const evaluation = assess(this.config, orgLevelKey, ratingInputs);

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
        },
      });

      return assessment;
    });

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
      assessed_at: saved.assessed_at,
      created_at: saved.created_at,
      updated_at: saved.updated_at,
      ratings: saved.ratings.map((r) => ({
        competency_key: r.competency_key,
        cefr: r.cefr,
        evidence: r.evidence,
      })),
      evaluation,
    };
  }

  async getAssessmentById(id: string): Promise<FormattedCommAssessmentResponse> {
    const assessment = await db.commAssessment.findUnique({
      where: { id },
      include: {
        employee: true,
        assessor: {
          include: { employee: true },
        },
        ratings: true,
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

    const evaluation = assess(this.config, assessment.org_level_key, ratingInputs);

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
      assessed_at: assessment.assessed_at,
      created_at: assessment.created_at,
      updated_at: assessment.updated_at,
      ratings: assessment.ratings.map((r) => ({
        competency_key: r.competency_key,
        cefr: r.cefr,
        evidence: r.evidence,
      })),
      evaluation,
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
        employee: true,
        assessor: {
          include: { employee: true },
        },
        ratings: true,
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

    const evaluation = assess(this.config, assessment.org_level_key, ratingInputs);

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
      assessed_at: assessment.assessed_at,
      created_at: assessment.created_at,
      updated_at: assessment.updated_at,
      ratings: assessment.ratings.map((r) => ({
        competency_key: r.competency_key,
        cefr: r.cefr,
        evidence: r.evidence,
      })),
      evaluation,
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
      },
    });

    return assessments.map((a) => {
      const ratingInputs: RatingInput[] = a.ratings.map((r) => ({
        competencyKey: r.competency_key,
        cefr: r.cefr as CefrLevelCode,
        evidence: r.evidence,
      }));
      const evaluation = assess(this.config, a.org_level_key, ratingInputs);

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
        assessed_at: a.assessed_at,
        created_at: a.created_at,
        updated_at: a.updated_at,
        ratingCount: a.ratings.length,
        overallCefr: evaluation.overallCefr,
        overallGap: evaluation.overallGap,
        overallStatus: evaluation.overallStatus,
        communicationReady: evaluation.communicationReady,
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
          employee: true,
          assessor: {
            include: { employee: true },
          },
          ratings: true,
        },
      });
    });

    const ratingInputs: RatingInput[] = updated.ratings.map((r) => ({
      competencyKey: r.competency_key,
      cefr: r.cefr as CefrLevelCode,
      evidence: r.evidence,
    }));

    const evaluation = assess(this.config, updated.org_level_key, ratingInputs);

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
      assessed_at: updated.assessed_at,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
      ratings: updated.ratings.map((r) => ({
        competency_key: r.competency_key,
        cefr: r.cefr,
        evidence: r.evidence,
      })),
      evaluation,
    };
  }
}

export const communicationService = new CommunicationService();
