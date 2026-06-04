import { z } from 'zod';

export const createSkillAssessmentSchema = z.object({
  employee_id: z.string().min(1, 'Employee ID (emp_code) is required'),
  technology_id: z.number().int().positive('Technology ID must be a positive integer'),
  type: z.enum(['Primary', 'Secondary', 'Tertiary']),
  projects: z.number().int().min(0).max(3),
  level: z.enum(['Expert', 'Advanced', 'Proficient', 'Foundational', 'Awareness', 'Unset']).default('Unset'),
});

export const updateSkillAssessmentSchema = createSkillAssessmentSchema
  .omit({ employee_id: true, technology_id: true })
  .partial();

export const approveSkillAssessmentSchema = z.object({
  level: z.enum(['Expert', 'Advanced', 'Proficient', 'Foundational', 'Awareness', 'Unset']).optional(),
  type: z.enum(['Primary', 'Secondary', 'Tertiary']).optional(),
  projects: z.number().int().min(0).max(3).optional(),
});

export const getTeamRosterSchema = z.object({
  department: z.string().optional(),
  grade_id: z.number().int().optional(),
});

export type CreateSkillAssessmentRequest = z.infer<typeof createSkillAssessmentSchema>;
export type UpdateSkillAssessmentRequest = z.infer<typeof updateSkillAssessmentSchema>;
export type ApproveSkillAssessmentRequest = z.infer<typeof approveSkillAssessmentSchema>;
export type GetTeamRosterRequest = z.infer<typeof getTeamRosterSchema>;

export interface SkillAssessmentResponse {
  id: number;
  employee_id: string;   // emp_code e.g. "1818"
  technology_id: number;
  type: string;
  projects: number;
  level: string;
  status: string;
  assessed_by: string;   // emp_code of assessor e.g. "1139"
  assessed_at: string;
  updated_at: string;
}

export interface TeamMemberResponse {
  id: number;
  emp_code: string;
  full_name: string;
  department: string;
  email: string | null;
  current_grade: {
    id: number;
    code: string;
    title: string;
    level: number;
  };
  target_grade: {
    id: number;
    code: string;
    title: string;
    level: number;
  };
  skill_assessments_count: number;
}
