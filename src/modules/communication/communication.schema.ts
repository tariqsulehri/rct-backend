import { z } from 'zod';
import { CefrLevelCode, CompetencyKey, OrgLevelKey } from '../../scoring/cefr.config';

export const cefrLevelEnum = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

export const competencyKeyEnum = z.enum([
  'written_clarity',
  'spoken_fluency',
  'presentation',
  'active_listening',
  'stakeholder_exec',
  'cross_cultural',
]);

export const orgLevelKeyEnum = z.enum([
  'associate',
  'engineer',
  'senior',
  'lead',
  'manager',
  'senior_mgr',
  'director',
  'vp',
  'c_level',
]);

export const commRatingInputSchema = z.object({
  competency_key: competencyKeyEnum,
  cefr: cefrLevelEnum,
  evidence: z.string().max(2000).nullable().optional(),
});

export const createCommAssessmentSchema = z.object({
  employee_id: z.string().min(1, 'Employee ID or emp_code is required'),
  org_level_key: orgLevelKeyEnum.optional(),
  status: z.enum(['draft', 'pending', 'approved']).default('approved'),
  ratings: z.array(commRatingInputSchema).min(1).max(6),
});

export const updateCommAssessmentStatusSchema = z.object({
  status: z.enum(['draft', 'pending', 'approved']),
  ratings: z.array(commRatingInputSchema).optional(),
});

export type CreateCommAssessmentRequest = z.infer<typeof createCommAssessmentSchema>;
export type UpdateCommAssessmentStatusRequest = z.infer<typeof updateCommAssessmentStatusSchema>;
export type CommRatingInput = z.infer<typeof commRatingInputSchema>;
