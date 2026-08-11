import { z } from 'zod';

export const behavioralLevelEnum = z.enum(['L1', 'L2', 'L3', 'L4', 'L5']);

export const ratingInputSchema = z.object({
  competencyKey: z.string().min(1, 'Competency key is required'),
  level: behavioralLevelEnum,
  evidence: z.string().optional(),
});

export const createBehavioralAssessmentSchema = z.object({
  body: z.object({
    subjectId: z.string().min(1, 'Subject ID (Employee Code or ID) is required'),
    gradeKey: z.string().min(1, 'Grade key is required'),
    ratings: z
      .array(ratingInputSchema)
      .min(1, 'At least one competency rating must be provided'),
  }),
});

export type CreateBehavioralAssessmentInput = z.infer<
  typeof createBehavioralAssessmentSchema
>['body'];
