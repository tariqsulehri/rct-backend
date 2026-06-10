import { RoleCode } from './rbac';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        employeeId: number;
        empCode: string;
        role: RoleCode;
        username: string;
      };
    }
  }
}

export {};
