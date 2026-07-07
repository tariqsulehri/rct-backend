import type { PrismaClient } from '@prisma/client';
import { DEFAULT_SCORING_VALUES, LEVEL_WEIGHT } from './scoring.engine';
import {
  ScoringConfigBundle,
} from './scoring-config.service';
import { createScoreRecalculationService } from './score-recalculation.service';

const scoringConfig: ScoringConfigBundle = {
  scoringValues: DEFAULT_SCORING_VALUES,
  levelWeights: LEVEL_WEIGHT,
  projectCredits: {},
  scoredStatuses: ['approved'],
};

function createMockClient() {
  return {
    employee: { findUnique: jest.fn() },
    skillAssessment: { findMany: jest.fn() },
    technology: { findMany: jest.fn() },
    competencyScore: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  } as unknown as PrismaClient;
}

describe('score recalculation service', () => {
  it('recomputes one competency using only configured scored statuses', async () => {
    const client = createMockClient();
    jest.mocked(client.technology.findMany).mockResolvedValue([{ id: 10 }, { id: 11 }] as never);
    jest.mocked(client.skillAssessment.findMany).mockResolvedValue([
      { type: 'Primary', projects: 3, level: 'Expert', score: 0.5 },
    ] as never);
    jest.mocked(client.competencyScore.upsert).mockResolvedValue({} as never);

    const service = createScoreRecalculationService(client);

    const result = await service.recomputeOneCompetency({
      employeeId: 1,
      competencyId: 100,
      departmentId: 7,
      scoredStatuses: ['approved'],
    });

    expect(client.skillAssessment.findMany).toHaveBeenCalledWith({
      where: {
        employee_id: 1,
        technology_id: { in: [10, 11] },
        status: { in: ['approved'] },
      },
    });
    expect(client.competencyScore.upsert).toHaveBeenCalledWith({
      where: { employee_id_competency_id: { employee_id: 1, competency_id: 100 } },
      create: { employee_id: 1, department_id: 7, competency_id: 100, score: 0.5, level_label: 'L2 Intermediate', star_rating: 3 },
      update: { department_id: 7, score: 0.5, level_label: 'L2 Intermediate', star_rating: 3 },
    });
    expect(result).toEqual({
      employeeId: 1,
      competencyId: 100,
      score: 0.5,
      starRating: 3,
      levelLabel: 'L2 Intermediate',
    });
  });

  it('clears competency score when no scored assessments remain', async () => {
    const client = createMockClient();
    jest.mocked(client.technology.findMany).mockResolvedValue([{ id: 10 }] as never);
    jest.mocked(client.skillAssessment.findMany).mockResolvedValue([] as never);
    jest.mocked(client.competencyScore.upsert).mockResolvedValue({} as never);

    const service = createScoreRecalculationService(client);

    const result = await service.recomputeOneCompetency({
      employeeId: 1,
      competencyId: 100,
      departmentId: 7,
      scoredStatuses: ['approved'],
    });

    expect(client.competencyScore.upsert).toHaveBeenCalledWith({
      where: { employee_id_competency_id: { employee_id: 1, competency_id: 100 } },
      create: { employee_id: 1, department_id: 7, competency_id: 100, score: null, level_label: null, star_rating: null },
      update: { department_id: 7, score: null, level_label: null, star_rating: null },
    });
    expect(result).toEqual({
      employeeId: 1,
      competencyId: 100,
      score: null,
      starRating: null,
      levelLabel: null,
    });
  });

  it('recomputes assessed and existing score competencies for an employee', async () => {
    const client = createMockClient();
    const configReader = { getScoringConfigBundle: jest.fn().mockResolvedValue(scoringConfig) };
    jest.mocked(client.employee.findUnique).mockResolvedValue({ department_id: 7 } as never);
    jest.mocked(client.skillAssessment.findMany)
      .mockResolvedValueOnce([{ technology: { competency_id: 100 } }] as never)
      .mockResolvedValueOnce([{ type: 'Primary', projects: 3, level: 'Expert', score: 0.5 }] as never)
      .mockResolvedValueOnce([] as never);
    jest.mocked(client.competencyScore.findMany).mockResolvedValue([{ competency_id: 200 }] as never);
    jest.mocked(client.technology.findMany)
      .mockResolvedValueOnce([{ id: 10 }] as never)
      .mockResolvedValueOnce([{ id: 20 }] as never);
    jest.mocked(client.competencyScore.upsert).mockResolvedValue({} as never);

    const service = createScoreRecalculationService(client, { scoringConfigService: configReader });

    const result = await service.recomputeScoresForEmployee(1);

    expect(configReader.getScoringConfigBundle).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      employeeId: 1,
      competencyIds: [100, 200],
      updatedCount: 2,
      clearedCount: 1,
    });
    expect(client.competencyScore.upsert).toHaveBeenCalledTimes(2);
  });
});
