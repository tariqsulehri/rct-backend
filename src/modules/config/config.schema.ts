import { z } from 'zod';

export const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'MANAGER', 'ENGINEER']),
  employee_id: z.number().int().positive(),
});
export const updateUserSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  password: z.string().min(8).optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'ENGINEER']).optional(),
  is_active: z.boolean().optional(),
});

export const createEmployeeSchema = z.object({
  emp_code: z.string().min(1).max(20),
  full_name: z.string().min(1).max(200),
  department: z.string().min(1).max(100),
  email: z.string().email().nullable().optional(),
  current_grade_id: z.number().int().positive(),
  target_grade_id: z.number().int().positive(),
  manager_id: z.number().int().positive().nullable().optional(),
  department_id: z.number().int().positive().nullable().optional(),
});
export const updateEmployeeSchema = createEmployeeSchema.partial();

export const createGradeSchema = z.object({
  code: z.string().min(1).max(10),
  title: z.string().min(1).max(100),
  level: z.number().int().min(1),
  experience_years: z.number().int().min(0),
  performance_note: z.string().optional(),
});
export const updateGradeSchema = createGradeSchema.partial();

export const createSkillDomainSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
export const updateSkillDomainSchema = createSkillDomainSchema.partial();

export const createCompetencySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1),
  is_critical: z.boolean().optional(),
  category_id: z.number().int().positive(),
  domain_ids: z.array(z.number().int().positive()).min(1),
});
export const updateCompetencySchema = createCompetencySchema.partial();

export const createTechnologySchema = z.object({
  name: z.string().min(1).max(100),
  competency_id: z.number().int().positive(),
});
export const updateTechnologySchema = createTechnologySchema.partial();

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type CreateGradeInput = z.infer<typeof createGradeSchema>;
export type UpdateGradeInput = z.infer<typeof updateGradeSchema>;
export type CreateSkillDomainInput = z.infer<typeof createSkillDomainSchema>;
export type UpdateSkillDomainInput = z.infer<typeof updateSkillDomainSchema>;
export type CreateCompetencyInput = z.infer<typeof createCompetencySchema>;
export type UpdateCompetencyInput = z.infer<typeof updateCompetencySchema>;
export type CreateTechnologyInput = z.infer<typeof createTechnologySchema>;
export type UpdateTechnologyInput = z.infer<typeof updateTechnologySchema>;

export const updateAssessmentTypeConfigSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  weight: z.number().min(0).max(1).optional(),
  description: z.string().nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export type UpdateAssessmentTypeConfigInput = z.infer<typeof updateAssessmentTypeConfigSchema>;

export const updateAssessmentLevelConfigSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  weight: z.number().min(0).max(1).optional(),
  threshold: z.number().min(0).max(1).nullable().optional(),
  description: z.string().nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export const updateAssessmentStatusConfigSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  counts_toward_score: z.boolean().optional(),
  is_terminal: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export const updateAssessmentProjectConfigSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  duration_months_min: z.number().int().min(0).nullable().optional(),
  duration_months_max: z.number().int().min(0).nullable().optional(),
  credit: z.number().min(0).max(1).optional(),
  threshold: z.number().min(0).max(1).nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export type UpdateAssessmentLevelConfigInput = z.infer<typeof updateAssessmentLevelConfigSchema>;
export type UpdateAssessmentStatusConfigInput = z.infer<typeof updateAssessmentStatusConfigSchema>;
export type UpdateAssessmentProjectConfigInput = z.infer<typeof updateAssessmentProjectConfigSchema>;

export const createCompetencyCategorySchema = z.object({
  name:        z.string().min(1).max(100),
  description: z.string().optional(),
  color:       z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
export const updateCompetencyCategorySchema = createCompetencyCategorySchema.partial();

export type CreateCompetencyCategoryInput = z.infer<typeof createCompetencyCategorySchema>;
export type UpdateCompetencyCategoryInput = z.infer<typeof updateCompetencyCategorySchema>;

export const createDepartmentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});
export const updateDepartmentSchema = createDepartmentSchema.partial();

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;

// Department Config (scoring values + domain overrides)
export const upsertDepartmentConfigSchema = z.object({
  primary_weight:   z.number().min(0).max(1),
  secondary_weight: z.number().min(0).max(1),
  tertiary_weight:  z.number().min(0).max(1),
  notes:            z.string().optional(),
});

export const upsertDomainWeightSchema = z.object({
  domain_id: z.number().int().positive(),
  weight:    z.number().min(0).max(1),
  is_active: z.boolean(),
});

export const bulkUpsertDomainWeightsSchema = z.object({
  weights: z.array(upsertDomainWeightSchema),
});

export type UpsertDepartmentConfigInput = z.infer<typeof upsertDepartmentConfigSchema>;
export type BulkUpsertDomainWeightsInput = z.infer<typeof bulkUpsertDomainWeightsSchema>;

// Domain Grade Weights
export const upsertDomainGradeWeightSchema = z.object({
  domain_id: z.number().int().positive(),
  grade_id:  z.number().int().positive(),
  weight:    z.number().min(0).max(1),
});
export type UpsertDomainGradeWeightInput = z.infer<typeof upsertDomainGradeWeightSchema>;
