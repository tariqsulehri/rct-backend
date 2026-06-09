import { PrismaClient } from '@prisma/client';
import {
  computeAssessmentScore,
  computeCompetencyScore,
  DEFAULT_SCORING_VALUES,
  LEVEL_WEIGHT,
  ScoringValues,
} from '../scoring/scoring.engine';

const db = new PrismaClient();

async function getConfiguredScoringValues(): Promise<ScoringValues> {
  const configs = await db.assessmentTypeConfig.findMany({
    where: { code: { in: ['Primary', 'Secondary', 'Tertiary'] }, is_active: true },
  });
  const byCode = new Map(configs.map((config) => [config.code, config.weight]));
  return {
    primary: byCode.get('Primary') ?? DEFAULT_SCORING_VALUES.primary,
    secondary: byCode.get('Secondary') ?? DEFAULT_SCORING_VALUES.secondary,
    tertiary: byCode.get('Tertiary') ?? DEFAULT_SCORING_VALUES.tertiary,
  };
}

async function getConfiguredLevelWeights(): Promise<Record<string, number>> {
  const configs = await db.assessmentLevelConfig.findMany({ where: { is_active: true } });
  return {
    ...LEVEL_WEIGHT,
    ...Object.fromEntries(configs.map((config) => [config.code, config.weight])),
  };
}

async function getConfiguredProjectCredits(): Promise<Record<number, number>> {
  const configs = await db.assessmentProjectConfig.findMany({ where: { is_active: true } });
  return Object.fromEntries(configs.map((config) => [config.project_count, config.credit]));
}

async function getScoredAssessmentStatuses(): Promise<string[]> {
  const configs = await db.assessmentStatusConfig.findMany({
    where: { is_active: true, counts_toward_score: true },
    select: { code: true },
  });
  const statuses = configs.map((config) => config.code);
  return statuses.length > 0 ? statuses : ['approved'];
}

async function main() {
  const [scoringValues, levelWeights, projectCredits, scoredStatuses] = await Promise.all([
    getConfiguredScoringValues(),
    getConfiguredLevelWeights(),
    getConfiguredProjectCredits(),
    getScoredAssessmentStatuses(),
  ]);
  const competencyDomainMaps = await db.competencyDomainMap.findMany({
    orderBy: [{ is_primary: 'desc' }, { id: 'asc' }],
    select: { competency_id: true, domain_id: true },
  });
  const domainIdByCompetencyId = new Map<number, number>();
  for (const map of competencyDomainMaps) {
    if (!domainIdByCompetencyId.has(map.competency_id)) {
      domainIdByCompetencyId.set(map.competency_id, map.domain_id);
    }
  }

  // 1. Backfill score on every SkillAssessment row
  const assessments = await db.skillAssessment.findMany({
    include: {
      employee: { select: { department_id: true } },
      technology: { select: { competency_id: true } },
    },
  });
  console.log(`Backfilling ${assessments.length} skill assessments...`);

  for (const a of assessments) {
    const score = computeAssessmentScore(a.type, a.projects, a.level, scoringValues, levelWeights, projectCredits);
    await db.skillAssessment.update({
      where: { id: a.id },
      data: {
        department_id: a.employee.department_id,
        domain_id: domainIdByCompetencyId.get(a.technology.competency_id) ?? null,
        competency_id: a.technology.competency_id,
        score,
      },
    });
  }
  console.log(`✔ Assessment scores written.`);

  // 2. Recompute CompetencyScore rows from stored scores
  const employees = await db.employee.findMany({ select: { id: true, department_id: true } });
  console.log(`Recomputing competency scores for ${employees.length} employees...`);

  let compUpdated = 0;
  for (const emp of employees) {
    const assessed = await db.skillAssessment.findMany({
      where: { employee_id: emp.id, status: { in: scoredStatuses } },
      include: { technology: { select: { competency_id: true } } },
    });
    const competencyIds = [...new Set(assessed.map((a) => a.technology.competency_id))];

    for (const compId of competencyIds) {
      const techIds = (await db.technology.findMany({
        where: { competency_id: compId }, select: { id: true },
      })).map((t) => t.id);

      const rows = await db.skillAssessment.findMany({
        where: { employee_id: emp.id, technology_id: { in: techIds }, status: { in: scoredStatuses } },
      });

      const { score, starRating, levelLabel } = computeCompetencyScore(
        rows.map((row) => ({
          type: row.type,
          projects: row.projects,
          level: row.level,
          storedScore: row.score,
        })),
        scoringValues,
        levelWeights,
        projectCredits,
      );

      await db.competencyScore.upsert({
        where: { employee_id_competency_id: { employee_id: emp.id, competency_id: compId } },
        create: { employee_id: emp.id, department_id: emp.department_id, competency_id: compId, score, level_label: levelLabel, star_rating: starRating },
        update: { department_id: emp.department_id, score, level_label: levelLabel, star_rating: starRating },
      });
      compUpdated++;
    }
  }

  console.log(`✔ ${compUpdated} competency score rows upserted.`);
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
