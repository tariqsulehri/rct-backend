export type CefrLevelCode = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export type CompetencyKey =
  | 'written_clarity'
  | 'spoken_fluency'
  | 'presentation'
  | 'active_listening'
  | 'stakeholder_exec'
  | 'cross_cultural';

export type OrgLevelKey =
  | 'associate'
  | 'engineer'
  | 'senior'
  | 'lead'
  | 'manager'
  | 'senior_mgr'
  | 'director'
  | 'vp'
  | 'c_level';

export type AssessmentStatus = 'BELOW' | 'MEETS' | 'ABOVE';

export type GatePolicy = 'overall' | 'all_competencies';

export interface CefrLevelDefinition {
  code: CefrLevelCode;
  ordinal: number;
  weight: number;
  label: string;
}

export interface CefrBandThreshold {
  ltWeight: number;
  code: CefrLevelCode;
}

export interface CefrCompetencyDefinition {
  key: CompetencyKey | string;
  name: string;
  sortOrder: number;
}

export interface CefrOrgLevelDefinition {
  key: OrgLevelKey | string;
  ordinal: number;
  name: string;
  expectedCefr: CefrLevelCode;
}

export interface CefrPolicyConfig {
  gateFromOrdinal: number;
  gatePolicy: GatePolicy;
  roundDecimals: number;
  roundingMode: 'half_up';
}

export interface CefrEngineConfig {
  cefrLevels: Record<CefrLevelCode, CefrLevelDefinition>;
  bandThresholds: CefrBandThreshold[];
  competencies: CefrCompetencyDefinition[];
  policy: CefrPolicyConfig;
}

export const CEFR_LEVELS: Record<CefrLevelCode, CefrLevelDefinition> = {
  A1: { code: 'A1', ordinal: 1, weight: 0.17, label: 'Beginner' },
  A2: { code: 'A2', ordinal: 2, weight: 0.33, label: 'Elementary' },
  B1: { code: 'B1', ordinal: 3, weight: 0.50, label: 'Intermediate' },
  B2: { code: 'B2', ordinal: 4, weight: 0.67, label: 'Upper-Intermediate' },
  C1: { code: 'C1', ordinal: 5, weight: 0.83, label: 'Advanced' },
  C2: { code: 'C2', ordinal: 6, weight: 1.00, label: 'Proficiency' },
};

export const CEFR_WEIGHTS: Record<CefrLevelCode, number> = {
  A1: 0.17,
  A2: 0.33,
  B1: 0.50,
  B2: 0.67,
  C1: 0.83,
  C2: 1.00,
};

export const CEFR_BAND_THRESHOLDS: CefrBandThreshold[] = [
  { ltWeight: 0.25, code: 'A1' },
  { ltWeight: 0.415, code: 'A2' },
  { ltWeight: 0.585, code: 'B1' },
  { ltWeight: 0.75, code: 'B2' },
  { ltWeight: 0.915, code: 'C1' },
  { ltWeight: 1.01, code: 'C2' },
];

export const CEFR_COMPETENCIES: CefrCompetencyDefinition[] = [
  { key: 'written_clarity', name: 'Written Clarity & Documentation', sortOrder: 1 },
  { key: 'spoken_fluency', name: 'Spoken Fluency & Meeting Presence', sortOrder: 2 },
  { key: 'presentation', name: 'Technical Presentation & Demos', sortOrder: 3 },
  { key: 'active_listening', name: 'Active Listening & Feedback Reception', sortOrder: 4 },
  { key: 'stakeholder_exec', name: 'Stakeholder & Executive Alignment', sortOrder: 5 },
  { key: 'cross_cultural', name: 'Cross-Cultural & Global Collaboration', sortOrder: 6 },
];

export const DEFAULT_CEFR_POLICY: CefrPolicyConfig = {
  gateFromOrdinal: 3,
  gatePolicy: 'overall',
  roundDecimals: 2,
  roundingMode: 'half_up',
};

export const DEFAULT_CEFR_CONFIG: CefrEngineConfig = {
  cefrLevels: CEFR_LEVELS,
  bandThresholds: CEFR_BAND_THRESHOLDS,
  competencies: CEFR_COMPETENCIES,
  policy: DEFAULT_CEFR_POLICY,
};
