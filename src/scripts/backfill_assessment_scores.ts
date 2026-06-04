import { PrismaClient } from '@prisma/client';
import {
  computeAssessmentScore,
  computeCompetencyScore,
  DEFAULT_FORMULA_WEIGHTS,
  FormulaWeights,
} from '../scoring/scoring.engine';

const db = new PrismaClient();

async function getDeptFormulaWeights(employeeId: number): Promise<FormulaWeights> {
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: { department_id: true },
  });
  if (!employee?.department_id) return DEFAULT_FORMULA_WEIGHTS;

  const config = await db.departmentConfig.findUnique({
    where: { department_id: employee.department_id },
  });
  if (!config) return DEFAULT_FORMULA_WEIGHTS;

  return {
    primary: config.primary_weight,
    secondary: config.secondary_weight,
    tertiary: config.tertiary_weight,
  };
}

async function main() {
  // 1. Backfill score on every SkillAssessment row
  const assessments = await db.skillAssessment.findMany();
  console.log(`Backfilling ${assessments.length} skill assessments...`);

  for (const a of assessments) {
    const weights = await getDeptFormulaWeights(a.employee_id);
    const score = computeAssessmentScore(a.type, a.projects, a.level, weights);
    await db.skillAssessment.update({ where: { id: a.id }, data: { score } });
  }
  console.log(`✔ Assessment scores written.`);

  // 2. Recompute CompetencyScore rows from stored scores
  const employees = await db.employee.findMany({ select: { id: true } });
  console.log(`Recomputing competency scores for ${employees.length} employees...`);

  let compUpdated = 0;
  for (const emp of employees) {
    const weights = await getDeptFormulaWeights(emp.id);
    const assessed = await db.skillAssessment.findMany({
      where: { employee_id: emp.id, status: 'approved' },
      include: { technology: { select: { competency_id: true } } },
    });
    const competencyIds = [...new Set(assessed.map((a) => a.technology.competency_id))];

    for (const compId of competencyIds) {
      const techIds = (await db.technology.findMany({
        where: { competency_id: compId }, select: { id: true },
      })).map((t) => t.id);

      const rows = await db.skillAssessment.findMany({
        where: { employee_id: emp.id, technology_id: { in: techIds }, status: 'approved' },
      });

      const { score, starRating, levelLabel } = computeCompetencyScore(
        rows.map((row) => ({
          type: row.type,
          projects: row.projects,
          level: row.level,
          storedScore: row.score,
        })),
        weights,
      );

      await db.competencyScore.upsert({
        where: { employee_id_competency_id: { employee_id: emp.id, competency_id: compId } },
        create: { employee_id: emp.id, competency_id: compId, score, level_label: levelLabel, star_rating: starRating },
        update: { score, level_label: levelLabel, star_rating: starRating },
      });
      compUpdated++;
    }
  }

  console.log(`✔ ${compUpdated} competency score rows upserted.`);
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
