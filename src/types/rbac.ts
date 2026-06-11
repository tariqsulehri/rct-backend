export const ROLE_CODES = ['ADMIN', 'TOP_MANAGEMENT', 'MANAGER', 'LINE_MANAGER', 'ENGINEER'] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export const PERMISSION_CODES = [
  'config.manage',
  'users.manage',
  'roles.manage',
  'assignments.manage',
  'reports.view',
  'employees.view',
  'employees.manage',
  'assessments.manage',
  'assessments.approve',
  'self.view',
  'self.assessment_submit',
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];
