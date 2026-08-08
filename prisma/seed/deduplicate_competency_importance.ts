import { db } from '../../src/config/database';
import logger from '../../src/config/logger';
import { createScoringConfigService } from '../../src/scoring/scoring-config.service';
import { createScoreRecalculationService } from '../../src/scoring/score-recalculation.service';

const scoringConfigService = createScoringConfigService(db);
const scoreRecalculationService = createScoreRecalculationService(db, {
  scoringConfigService,
  logger,
  swallowErrors: true,
});

async function main() {
  logger.info('Starting deduplication of skill assessments by (employee_id, competency_id, type)...');

  // 1. Create backup table for auditing
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS skill_assessments_conflict_backup (
      backup_id SERIAL PRIMARY KEY,
      backed_up_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      id INT,
      employee_id INT,
      department_id INT,
      domain_id INT,
      competency_id INT,
      technology_id INT,
      type VARCHAR,
      projects INT,
      level VARCHAR,
      score NUMERIC,
      status VARCHAR,
      assessed_by INT,
      assessed_at TIMESTAMP WITH TIME ZONE,
      updated_at TIMESTAMP WITH TIME ZONE
    );
  `);

  // 2. Find duplicate clusters
  const duplicates = await db.$queryRaw<Array<{
    employee_id: number;
    competency_id: number;
    type: string;
    count: bigint;
  }>>`
    SELECT employee_id, competency_id, type, COUNT(*) as count
    FROM skill_assessments
    WHERE competency_id IS NOT NULL
    GROUP BY employee_id, competency_id, type
    HAVING COUNT(*) > 1;
  `;

  logger.info({ duplicateClusterCount: duplicates.length }, 'Found duplicate clusters to resolve');

  const affectedEmployeeIds = new Set<number>();

  for (const cluster of duplicates) {
    const rows = await db.skillAssessment.findMany({
      where: {
        employee_id: cluster.employee_id,
        competency_id: cluster.competency_id,
        type: cluster.type,
      },
      orderBy: [
        { score: 'desc' },
        { status: 'desc' },
        { projects: 'desc' },
        { id: 'asc' },
      ],
    });

    if (rows.length <= 1) continue;

    affectedEmployeeIds.add(cluster.employee_id);
    const [winner, ...losers] = rows;

    logger.info({
      employeeId: cluster.employee_id,
      competencyId: cluster.competency_id,
      type: cluster.type,
      retainedId: winner.id,
      retainedTechId: winner.technology_id,
      retainedScore: winner.score,
      deletedIds: losers.map((l) => l.id),
    }, 'Resolving duplicate importance cluster');

    // Backup losers before deleting
    for (const loser of losers) {
      await db.$executeRaw`
        INSERT INTO skill_assessments_conflict_backup (
          id, employee_id, department_id, domain_id, competency_id, technology_id,
          type, projects, level, score, status, assessed_by, assessed_at, updated_at
        ) VALUES (
          ${loser.id}, ${loser.employee_id}, ${loser.department_id}, ${loser.domain_id},
          ${loser.competency_id}, ${loser.technology_id}, ${loser.type}, ${loser.projects},
          ${loser.level}, ${loser.score}, ${loser.status}, ${loser.assessed_by},
          ${loser.assessed_at}, ${loser.updated_at}
        );
      `;

      await db.skillAssessment.delete({
        where: { id: loser.id },
      });
    }
  }

  // 3. Recalculate scores for affected employees
  for (const empId of affectedEmployeeIds) {
    logger.info({ empId }, 'Recalculating competency scores for employee');
    await scoreRecalculationService.recomputeScoresForEmployee(empId);
  }

  logger.info('Deduplication completed successfully.');
}

main()
  .catch((err) => {
    logger.error({ err }, 'Error during deduplication');
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
