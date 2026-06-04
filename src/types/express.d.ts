declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        employeeId: number;
        role: 'ADMIN' | 'MANAGER' | 'ENGINEER';
        username: string;
      };
    }
  }
}

export {};
