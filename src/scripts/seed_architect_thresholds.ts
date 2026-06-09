/**
 * Seed grade_matrix thresholds for G17–G21 (Architect grades).
 *
 * Pattern from existing data:
 *   G13 (Associate): avg 0.27  [0.1–0.4]
 *   G14 (Engineer):  avg 0.53  [0.4–0.6]
 *   G15 (Senior):    all 0.75
 *   G16 (Principal): all 1.00  (Security & Performance = 0.95)
 *
 * Architect grades (G17–G21) maintain G16 maximums — the competency scoring
 * system already peaks here; progression beyond G16 is about leadership,
 * architecture scope, and delivery breadth, not raw technology scores.
 *
 * All architect grades: 1.0 for all competencies
 *   Exception: "Security and Performance" stays at 0.95 (matches G16)
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const ARCHITECT_GRADES = ['G17', 'G18', 'G19', 'G20', 'G21'];

async function main() {
  const grades = await db.grade.findMany({
    where: { code: { in: ARCHITECT_GRADES } },
    select: { id: true, code: true },
  });
  console.log('Architect grades found:', grades.map((g) => g.code).join(', '));

  const competencies = await db.competency.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  console.log(`Competencies: ${competencies.length}`);

  const organization = await db.organization.upsert({
    where: { slug: 'tkxel' },
    update: { name: 'tkxel', logo_url: '/assets/organizations/tkxel-logo.svg', base_url: 'https://tkxel.com' },
    create: { name: 'tkxel', slug: 'tkxel', logo_url: '/assets/organizations/tkxel-logo.svg', base_url: 'https://tkxel.com' },
  });
  const devOpsDepartment = await db.department.upsert({
    where: { organization_id_name: { organization_id: organization.id, name: 'DevOps' } },
    update: {},
    create: {
      organization_id: organization.id,
      name: 'DevOps',
      description: 'Default department for the current DevOps scoring data.',
    },
  });

  let inserted = 0;
  let skipped  = 0;

  for (const grade of grades) {
    for (const comp of competencies) {
      // Security and Performance mirrors G16's 0.95; everything else is 1.0
      const threshold = comp.name === 'Security and Performance' ? 0.95 : 1.0;

      const existing = await db.gradeMatrix.findUnique({
        where: {
          department_id_grade_id_competency_id: {
            department_id: devOpsDepartment.id,
            grade_id: grade.id,
            competency_id: comp.id,
          },
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await db.gradeMatrix.create({
        data: { department_id: devOpsDepartment.id, grade_id: grade.id, competency_id: comp.id, threshold },
      });
      inserted++;
    }
  }

  console.log(`✔ Inserted ${inserted} thresholds, skipped ${skipped} (already existed).`);
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
