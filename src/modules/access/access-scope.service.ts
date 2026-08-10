import { db } from '../../config/database';
import { RoleCode } from '../../types/rbac';

interface AuthUser {
  id: number;
  employeeId: number;
  role: RoleCode;
}

function activeAssignmentWhere(now = new Date()) {
  return {
    is_active: true,
    starts_at: { lte: now },
    OR: [{ ends_at: null }, { ends_at: { gte: now } }],
  };
}

export const accessScopeService = {
  async getAccessibleEmployeeIds(user: AuthUser, options: { forAssessment?: boolean } = {}): Promise<number[]> {
    if (user.role === 'ADMIN' || (user.role === 'TOP_MANAGEMENT' && !options.forAssessment)) {
      const employees = await db.employee.findMany({
        where: { deleted_at: null, is_active: true },
        select: { id: true },
      });
      return employees.map((employee) => employee.id);
    }

    const ids = new Set<number>();
    ids.add(user.employeeId);

    const now = new Date();

    const departmentAssignments = await db.userDepartmentAssignment.findMany({
      where: {
        user_id: user.id,
        can_view: true,
        ...activeAssignmentWhere(now),
      },
      select: { department_id: true, can_manage: true },
    });

    const departmentIds = departmentAssignments
      .filter((assignment) => !options.forAssessment || assignment.can_manage)
      .map((assignment) => assignment.department_id);

    if (departmentIds.length > 0) {
      const departmentEmployees = await db.employee.findMany({
        where: {
          deleted_at: null,
          is_active: true,
          department_id: { in: departmentIds },
        },
        select: { id: true },
      });
      for (const employee of departmentEmployees) ids.add(employee.id);
    }

    const lineAssignments = await db.employeeLineManagerAssignment.findMany({
      where: {
        manager_user_id: user.id,
        can_view: true,
        ...(options.forAssessment ? { can_assess: true } : {}),
        ...activeAssignmentWhere(now),
      },
      select: { employee_id: true },
    });
    for (const assignment of lineAssignments) ids.add(assignment.employee_id);


    // New Requirement: Manager can see all employees in their own department.
    if (user.role === 'MANAGER') {
      const managerEmp = await db.employee.findUnique({
        where: { id: user.employeeId },
        select: { department_id: true },
      });
      if (managerEmp?.department_id) {
        const departmentEmployees = await db.employee.findMany({
          where: { department_id: managerEmp.department_id, deleted_at: null, is_active: true },
          select: { id: true },
        });
        for (const employee of departmentEmployees) ids.add(employee.id);
      }
    }

    return [...ids];
  },

  async canAccessEmployee(user: AuthUser, employeeId: number, options: { forAssessment?: boolean } = {}): Promise<boolean> {
    if (user.role === 'ADMIN' || (user.role === 'TOP_MANAGEMENT' && !options.forAssessment)) {
      const count = await db.employee.count({
        where: { id: employeeId, deleted_at: null, is_active: true },
      });
      return count > 0;
    }

    if (user.employeeId === employeeId) return true;

    const now = new Date();

    const departmentAssignment = await db.userDepartmentAssignment.findFirst({
      where: {
        user_id: user.id,
        can_view: true,
        ...(options.forAssessment ? { can_manage: true } : {}),
        ...activeAssignmentWhere(now),
        department: {
          employees: {
            some: { id: employeeId, deleted_at: null },
          },
        },
      },
      select: { id: true },
    });
    if (departmentAssignment) return true;

    const lineAssignment = await db.employeeLineManagerAssignment.findFirst({
      where: {
        manager_user_id: user.id,
        employee_id: employeeId,
        can_view: true,
        ...(options.forAssessment ? { can_assess: true } : {}),
        ...activeAssignmentWhere(now),
      },
      select: { id: true },
    });
    if (lineAssignment) return true;


    // New Requirement: Manager can access all employees in their own department.
    if (user.role === 'MANAGER') {
      const managerEmp = await db.employee.findUnique({
        where: { id: user.employeeId },
        select: { department_id: true },
      });
      if (managerEmp?.department_id) {
        const deptEmployeeCount = await db.employee.count({
          where: { id: employeeId, department_id: managerEmp.department_id, deleted_at: null, is_active: true },
        });
        if (deptEmployeeCount > 0) return true;
      }
    }

    return false;
  },
};
