import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(50),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type LoginRequest = z.infer<typeof loginSchema>;

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  user: z.object({
    id: z.number(),
    employeeId: z.number(),
    empCode: z.string(),
    username: z.string(),
    role: z.enum(['ADMIN', 'TOP_MANAGEMENT', 'MANAGER', 'LINE_MANAGER', 'ENGINEER']),
    employeeName: z.string(),
    department: z.string(),
    currentGrade: z.string(),
    currentGradeTitle: z.string(),
    targetGrade: z.string(),
    targetGradeTitle: z.string(),
  }),
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;
