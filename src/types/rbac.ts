export const ROLE_CODES = ['ADMIN', 'TOP_MANAGEMENT', 'MANAGER', 'LINE_MANAGER', 'ENGINEER'] as const;

export type RoleCode = (typeof ROLE_CODES)[number];
