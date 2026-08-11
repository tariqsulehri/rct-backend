import { db } from '../../config/database';
import {
  assessBehavioral,
  BehavioralEngineConfig,
  BehavioralLevel,
} from '../../scoring/behavioral.engine';
import { CreateBehavioralAssessmentInput } from './behavioral.schema';

export const behavioralService = {
  /**
   * Ensures default behavioral framework reference data exists in the database
   */
  async ensureReferenceData(): Promise<void> {
    const levelCount = await db.behavLevel.count();
    if (levelCount === 0) {
      const BEHAV_LEVELS = [
        { code: 'L1', ordinal: 1, centi_weight: 20, label: 'Intermediate' },
        { code: 'L2', ordinal: 2, centi_weight: 40, label: 'Proficient' },
        { code: 'L3', ordinal: 3, centi_weight: 60, label: 'Advanced' },
        { code: 'L4', ordinal: 4, centi_weight: 80, label: 'Leads' },
        { code: 'L5', ordinal: 5, centi_weight: 100, label: 'Strategic' },
      ];
      for (const lvl of BEHAV_LEVELS) {
        await db.behavLevel.upsert({
          where: { code: lvl.code },
          update: lvl,
          create: lvl,
        });
      }
    }

    const compCount = await db.behavCompetency.count();
    if (compCount === 0) {
      const BEHAV_COMPETENCIES = [
        { key: 'ownership', name: 'Ownership & Accountability', type: 'core', sort: 1 },
        { key: 'collaboration', name: 'Collaboration & Influence', type: 'core', sort: 2 },
        { key: 'customer_business', name: 'Customer & Business Focus', type: 'core', sort: 3 },
        { key: 'communication', name: 'Communication', type: 'core', sort: 4 },
        { key: 'adaptability', name: 'Adaptability & Learning', type: 'core', sort: 5 },
        { key: 'integrity', name: 'Integrity & Judgment', type: 'core', sort: 6 },
        { key: 'develops_people', name: 'Develops People', type: 'leadership', sort: 7 },
        { key: 'strategic_thinking', name: 'Strategic Thinking', type: 'leadership', sort: 8 },
        { key: 'drives_change', name: 'Drives Change', type: 'leadership', sort: 9 },
        { key: 'decision_making', name: 'Decision-Making', type: 'leadership', sort: 10 },
        { key: 'builds_teams', name: 'Builds & Leads Teams', type: 'leadership', sort: 11 },
      ];
      for (const comp of BEHAV_COMPETENCIES) {
        await db.behavCompetency.upsert({
          where: { key: comp.key },
          update: comp,
          create: comp,
        });
      }
    }

    const gradeCount = await db.behavGrade.count();
    if (gradeCount === 0) {
      const BEHAV_GRADES = [
        { key: 'G13', ordinal: 1, name: 'Associate' },
        { key: 'G14', ordinal: 2, name: 'Engineer' },
        { key: 'G15', ordinal: 3, name: 'Senior' },
        { key: 'G16', ordinal: 4, name: 'Principal' },
        { key: 'G17', ordinal: 5, name: 'Associate Architect' },
      ];
      for (const g of BEHAV_GRADES) {
        await db.behavGrade.upsert({
          where: { key: g.key },
          update: g,
          create: g,
        });
      }
    }

    const expectedCount = await db.behavExpected.count();
    if (expectedCount === 0) {
      const EXPECTED_MATRIX: Record<string, Record<string, string>> = {
        G13: { ownership: 'L1', collaboration: 'L1', customer_business: 'L1', communication: 'L2', adaptability: 'L1', integrity: 'L3' },
        G14: { ownership: 'L2', collaboration: 'L2', customer_business: 'L2', communication: 'L2', adaptability: 'L2', integrity: 'L3' },
        G15: { ownership: 'L3', collaboration: 'L3', customer_business: 'L3', communication: 'L3', adaptability: 'L3', integrity: 'L4' },
        G16: { ownership: 'L4', collaboration: 'L4', customer_business: 'L4', communication: 'L4', adaptability: 'L3', integrity: 'L4', develops_people: 'L3', strategic_thinking: 'L3', drives_change: 'L3', decision_making: 'L3', builds_teams: 'L3' },
        G17: { ownership: 'L5', collaboration: 'L5', customer_business: 'L5', communication: 'L4', adaptability: 'L4', integrity: 'L5', develops_people: 'L4', strategic_thinking: 'L4', drives_change: 'L4', decision_making: 'L4', builds_teams: 'L4' },
      };
      for (const [gradeKey, compMap] of Object.entries(EXPECTED_MATRIX)) {
        for (const [compKey, levelCode] of Object.entries(compMap)) {
          await db.behavExpected.upsert({
            where: {
              grade_key_competency_key: { grade_key: gradeKey, competency_key: compKey },
            },
            update: { level: levelCode },
            create: { grade_key: gradeKey, competency_key: compKey, level: levelCode },
          });
        }
      }
    }
  },

  /**
   * Retrieves reference data (levels, competencies, grades, expected matrix, policy)
   */
  async getConfig(): Promise<BehavioralEngineConfig & {
    levels: Array<{ code: string; ordinal: number; centi_weight: number; label: string }>;
    competencies: Array<{ key: string; name: string; type: string; sort: number }>;
    dbGrades: Array<{ key: string; ordinal: number; name: string }>;
    performanceScale: Array<{ levelDiff: number; score: number; label: string }>;
  }> {
    // Auto-ensure reference data if DB tables are empty
    await this.ensureReferenceData();

    const [dbLevels, dbCompetencies, dbGrades, dbExpected] = await Promise.all([
      db.behavLevel.findMany({ orderBy: { ordinal: 'asc' } }),
      db.behavCompetency.findMany({ orderBy: { sort: 'asc' } }),
      db.behavGrade.findMany({ orderBy: { ordinal: 'asc' } }),
      db.behavExpected.findMany(),
    ]);

    // Build expectedMatrix map: gradeKey -> competencyKey -> level
    const expectedMatrix: Record<string, Record<string, BehavioralLevel | 'NA'>> = {};
    for (const g of dbGrades) {
      expectedMatrix[g.key] = {};
      for (const c of dbCompetencies) {
        expectedMatrix[g.key][c.key] = 'NA';
      }
    }

    for (const item of dbExpected) {
      if (!expectedMatrix[item.grade_key]) {
        expectedMatrix[item.grade_key] = {};
      }
      expectedMatrix[item.grade_key][item.competency_key] = item.level as BehavioralLevel;
    }

    const gradesMap: Record<string, { ordinal: number }> = {};
    for (const g of dbGrades) {
      gradesMap[g.key] = { ordinal: g.ordinal };
    }

    const competencyKeys = dbCompetencies.map((c: { key: string }) => c.key);

    return {
      levels: dbLevels,
      competencies: dbCompetencies,
      dbGrades,
      expectedMatrix,
      grades: gradesMap,
      competencyKeys,
      criticalCompetencies: ['integrity'],
      gatePolicy: 'overall',
      gateAppliesFromOrdinal: 1,
      performanceScale: [
        { levelDiff: -2, score: 1, label: 'Does Not Meet' },
        { levelDiff: -1, score: 2, label: 'Partially Meets' },
        { levelDiff: 0, score: 3, label: 'Meets' },
        { levelDiff: 1, score: 4, label: 'Exceeds' },
        { levelDiff: 2, score: 5, label: 'Role Model' },
      ],
    };
  },

  /**
   * Creates a new behavioral assessment and evaluates deterministic result
   */
  async createAssessment(data: CreateBehavioralAssessmentInput, assessorId?: string) {
    const config = await this.getConfig();

    // Verify grade exists
    if (!config.expectedMatrix[data.gradeKey]) {
      throw new Error(`Invalid grade key: ${data.gradeKey}`);
    }

    // Verify employee subject exists (by emp_code or id string)
    const emp = await db.employee.findFirst({
      where: {
        OR: [
          { emp_code: data.subjectId },
          { id: isNaN(Number(data.subjectId)) ? -1 : Number(data.subjectId) },
        ],
      },
    });

    const subjectIdStored = emp ? emp.emp_code : data.subjectId;

    // Run pure engine calculation
    const engineResult = assessBehavioral(config, data.gradeKey, data.ratings);

    // Save in DB transaction
    const createdAssessment = await db.$transaction(async (tx) => {
      const assessment = await tx.behavAssessment.create({
        data: {
          subject_id: subjectIdStored,
          grade_key: data.gradeKey,
          assessor_id: assessorId || null,
        },
      });

      await tx.behavRating.createMany({
        data: data.ratings.map((r) => ({
          assessment_id: assessment.id,
          competency_key: r.competencyKey,
          level: r.level,
          evidence: r.evidence || null,
        })),
      });

      return assessment;
    });

    return {
      id: createdAssessment.id,
      subjectId: subjectIdStored,
      gradeKey: createdAssessment.grade_key,
      assessedAt: createdAssessment.assessed_at,
      assessorId: createdAssessment.assessor_id,
      ratings: data.ratings,
      result: engineResult,
    };
  },

  /**
   * Fetches an assessment by ID and evaluates engine result
   */
  async getAssessmentById(id: string) {
    const assessment = await db.behavAssessment.findUnique({
      where: { id },
      include: {
        ratings: true,
      },
    });

    if (!assessment) {
      return null;
    }

    const config = await this.getConfig();
    const ratingsInput = assessment.ratings.map((r: { competency_key: string; level: string; evidence: string | null }) => ({
      competencyKey: r.competency_key,
      level: r.level as BehavioralLevel,
      evidence: r.evidence || undefined,
    }));

    const result = assessBehavioral(config, assessment.grade_key, ratingsInput);

    return {
      id: assessment.id,
      subjectId: assessment.subject_id,
      gradeKey: assessment.grade_key,
      assessedAt: assessment.assessed_at,
      assessorId: assessment.assessor_id,
      ratings: ratingsInput,
      result,
    };
  },

  /**
   * Gets the latest assessment for a subject employee
   */
  async getLatestAssessment(subjectIdInput: string) {
    const emp = await db.employee.findFirst({
      where: {
        OR: [
          { emp_code: subjectIdInput },
          { id: isNaN(Number(subjectIdInput)) ? -1 : Number(subjectIdInput) },
        ],
      },
    });

    const subjectIdToSearch = emp ? emp.emp_code : subjectIdInput;

    const latest = await db.behavAssessment.findFirst({
      where: { subject_id: subjectIdToSearch },
      orderBy: { assessed_at: 'desc' },
      include: { ratings: true },
    });

    if (!latest) {
      return null;
    }

    return this.getAssessmentById(latest.id);
  },

  /**
   * Gets all historical assessments for a subject employee
   */
  async getSubjectHistory(subjectIdInput: string) {
    const emp = await db.employee.findFirst({
      where: {
        OR: [
          { emp_code: subjectIdInput },
          { id: isNaN(Number(subjectIdInput)) ? -1 : Number(subjectIdInput) },
        ],
      },
    });

    const subjectIdToSearch = emp ? emp.emp_code : subjectIdInput;

    const assessments = await db.behavAssessment.findMany({
      where: { subject_id: subjectIdToSearch },
      orderBy: { assessed_at: 'desc' },
      include: { ratings: true },
    });

    const config = await this.getConfig();

    return assessments.map((a: { id: string; subject_id: string; grade_key: string; assessed_at: Date; assessor_id: string | null; ratings: Array<{ competency_key: string; level: string; evidence: string | null }> }) => {
      const ratingsInput = a.ratings.map((r: { competency_key: string; level: string; evidence: string | null }) => ({
        competencyKey: r.competency_key,
        level: r.level as BehavioralLevel,
        evidence: r.evidence || undefined,
      }));
      return {
        id: a.id,
        subjectId: a.subject_id,
        gradeKey: a.grade_key,
        assessedAt: a.assessed_at,
        assessorId: a.assessor_id,
        ratings: ratingsInput,
        result: assessBehavioral(config, a.grade_key, ratingsInput),
      };
    });
  },
};
