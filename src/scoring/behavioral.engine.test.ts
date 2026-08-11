import {
  assessBehavioral,
  BehavioralEngineConfig,
  BehavioralLevel,
} from './behavioral.engine';

describe('Behavioral Competency Rule Engine', () => {
  const defaultConfig: BehavioralEngineConfig = {
    expectedMatrix: {
      G13: {
        ownership: 'L1',
        collaboration: 'L1',
        customer_business: 'L1',
        communication: 'L2',
        adaptability: 'L1',
        integrity: 'L3',
        develops_people: 'NA',
        strategic_thinking: 'NA',
        drives_change: 'NA',
        decision_making: 'NA',
        builds_teams: 'NA',
      },
      G14: {
        ownership: 'L2',
        collaboration: 'L2',
        customer_business: 'L2',
        communication: 'L2',
        adaptability: 'L2',
        integrity: 'L3',
        develops_people: 'NA',
        strategic_thinking: 'NA',
        drives_change: 'NA',
        decision_making: 'NA',
        builds_teams: 'NA',
      },
      G15: {
        ownership: 'L3',
        collaboration: 'L3',
        customer_business: 'L3',
        communication: 'L3',
        adaptability: 'L3',
        integrity: 'L4',
        develops_people: 'NA',
        strategic_thinking: 'NA',
        drives_change: 'NA',
        decision_making: 'NA',
        builds_teams: 'NA',
      },
      G16: {
        ownership: 'L4',
        collaboration: 'L4',
        customer_business: 'L4',
        communication: 'L4',
        adaptability: 'L3',
        integrity: 'L4',
        develops_people: 'L3',
        strategic_thinking: 'L3',
        drives_change: 'L3',
        decision_making: 'L3',
        builds_teams: 'L3',
      },
      G17: {
        ownership: 'L5',
        collaboration: 'L5',
        customer_business: 'L5',
        communication: 'L4',
        adaptability: 'L4',
        integrity: 'L5',
        develops_people: 'L4',
        strategic_thinking: 'L4',
        drives_change: 'L4',
        decision_making: 'L4',
        builds_teams: 'L4',
      },
    },
    grades: {
      G13: { ordinal: 1 },
      G14: { ordinal: 2 },
      G15: { ordinal: 3 },
      G16: { ordinal: 4 },
      G17: { ordinal: 5 },
    },
    competencyKeys: [
      'ownership',
      'collaboration',
      'customer_business',
      'communication',
      'adaptability',
      'integrity',
      'develops_people',
      'strategic_thinking',
      'drives_change',
      'decision_making',
      'builds_teams',
    ],
    criticalCompetencies: ['integrity'],
    gatePolicy: 'overall',
    gateAppliesFromOrdinal: 1,
  };

  test('TV1 — Senior (G15), mixed ratings', () => {
    const ratings: { competencyKey: string; level: BehavioralLevel }[] = [
      { competencyKey: 'ownership', level: 'L3' },
      { competencyKey: 'collaboration', level: 'L4' },
      { competencyKey: 'customer_business', level: 'L3' },
      { competencyKey: 'communication', level: 'L2' },
      { competencyKey: 'adaptability', level: 'L3' },
      { competencyKey: 'integrity', level: 'L4' },
    ];

    const res = assessBehavioral(defaultConfig, 'G15', ratings);

    expect(res.overallCw).toBe(63);
    expect(res.overallProficiency).toBe('L3');
    expect(res.overallGapCw).toBe(0);
    expect(res.overallPerformance).toEqual({ levelDiff: 0, score: 3, label: 'Meets' });
    expect(res.behavioralReady).toBe(true);
    expect(res.developmentPriority).toEqual(['communication']);

    const colab = res.perCompetency.find((c) => c.competencyKey === 'collaboration')!;
    expect(colab.status).toBe('ABOVE');
    expect(colab.gapCw).toBe(20);
    expect(colab.performance).toEqual({ levelDiff: 1, score: 4, label: 'Exceeds' });

    const comm = res.perCompetency.find((c) => c.competencyKey === 'communication')!;
    expect(comm.status).toBe('BELOW');
    expect(comm.gapCw).toBe(-20);
    expect(comm.performance).toEqual({ levelDiff: -1, score: 2, label: 'Partially Meets' });
  });

  test('TV2 — Principal (G16), all at bar', () => {
    const ratings: { competencyKey: string; level: BehavioralLevel }[] = [
      { competencyKey: 'ownership', level: 'L4' },
      { competencyKey: 'collaboration', level: 'L4' },
      { competencyKey: 'customer_business', level: 'L4' },
      { competencyKey: 'communication', level: 'L4' },
      { competencyKey: 'adaptability', level: 'L3' },
      { competencyKey: 'integrity', level: 'L4' },
      { competencyKey: 'develops_people', level: 'L3' },
      { competencyKey: 'strategic_thinking', level: 'L3' },
      { competencyKey: 'drives_change', level: 'L3' },
      { competencyKey: 'decision_making', level: 'L3' },
      { competencyKey: 'builds_teams', level: 'L3' },
    ];

    const res = assessBehavioral(defaultConfig, 'G16', ratings);

    expect(res.overallCw).toBe(69);
    expect(res.overallProficiency).toBe('L3');
    expect(res.overallGapCw).toBe(0);
    expect(res.overallPerformance).toEqual({ levelDiff: 0, score: 3, label: 'Meets' });
    expect(res.behavioralReady).toBe(true);
    expect(res.developmentPriority).toEqual([]);
    expect(res.complete).toBe(true);
  });

  test('TV3 — Principal (G16), Integrity fails (critical override)', () => {
    const ratings: { competencyKey: string; level: BehavioralLevel }[] = [
      { competencyKey: 'ownership', level: 'L5' }, // +20
      { competencyKey: 'collaboration', level: 'L4' },
      { competencyKey: 'customer_business', level: 'L4' },
      { competencyKey: 'communication', level: 'L4' },
      { competencyKey: 'adaptability', level: 'L3' },
      { competencyKey: 'integrity', level: 'L3' }, // -20 (critical below bar!)
      { competencyKey: 'develops_people', level: 'L3' },
      { competencyKey: 'strategic_thinking', level: 'L3' },
      { competencyKey: 'drives_change', level: 'L3' },
      { competencyKey: 'decision_making', level: 'L3' },
      { competencyKey: 'builds_teams', level: 'L3' },
    ];

    const res = assessBehavioral(defaultConfig, 'G16', ratings);

    expect(res.overallCw).toBe(69);
    expect(res.overallGapCw).toBe(0);
    expect(res.overallPerformance).toEqual({ levelDiff: 0, score: 3, label: 'Meets' });
    expect(res.behavioralReady).toBe(false); // Hard blocked by Integrity!
    expect(res.developmentPriority).toEqual(['integrity']);
  });

  test('TV4 — Associate (G13), all at bar', () => {
    const ratings: { competencyKey: string; level: BehavioralLevel }[] = [
      { competencyKey: 'ownership', level: 'L1' },
      { competencyKey: 'collaboration', level: 'L1' },
      { competencyKey: 'customer_business', level: 'L1' },
      { competencyKey: 'communication', level: 'L2' },
      { competencyKey: 'adaptability', level: 'L1' },
      { competencyKey: 'integrity', level: 'L3' },
    ];

    const res = assessBehavioral(defaultConfig, 'G13', ratings);

    expect(res.overallCw).toBe(30);
    expect(res.overallProficiency).toBe('L2');
    expect(res.overallGapCw).toBe(0);
    expect(res.behavioralReady).toBe(true);
    expect(res.developmentPriority).toEqual([]);
    expect(res.ignoredRatings).toEqual([]);
  });

  test('TV5 — Incomplete assessment', () => {
    const ratings: { competencyKey: string; level: BehavioralLevel }[] = [
      { competencyKey: 'ownership', level: 'L4' },
      { competencyKey: 'collaboration', level: 'L4' },
      { competencyKey: 'integrity', level: 'L4' },
    ];

    const res = assessBehavioral(defaultConfig, 'G16', ratings);

    expect(res.complete).toBe(false);
    expect(res.behavioralReady).toBeNull();
  });
});
