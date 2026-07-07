import { PrismaClient } from '@prisma/client';
import {
  computeAssessmentScore,
} from '../scoring/scoring.engine';
import { createScoringConfigService } from '../scoring/scoring-config.service';
import { createScoreRecalculationService } from '../scoring/score-recalculation.service';

const db = new PrismaClient();
const scoringConfigService = createScoringConfigService(db, { fallbackOnError: false });
const scoreRecalculationService = createScoreRecalculationService(db, { scoringConfigService });

async function main() {
  const scoringConfig = await scoringConfigService.getScoringConfigBundle();
  const { scoringValues, levelWeights, projectCredits } = scoringConfig;
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
  const employees = await db.employee.findMany({ select: { id: true } });
  console.log(`Recomputing competency scores for ${employees.length} employees...`);

  let compUpdated = 0;
  for (const emp of employees) {
    const result = await scoreRecalculationService.recomputeScoresForEmployee(emp.id, scoringConfig);
    compUpdated += result.updatedCount;
  }

  console.log(`✔ ${compUpdated} competency score rows refreshed.`);
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
