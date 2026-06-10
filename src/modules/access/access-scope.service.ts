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
    if (user.role === 'ADMIN') {
      const employees = await db.employee.findMany({
        where: { deleted_at: null },
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

    // Transitional fallback: preserve existing manager_id behavior until all
    // managers are fully maintained through assignment tables.
    if (user.role === 'MANAGER' || user.role === 'LINE_MANAGER' || user.role === 'TOP_MANAGEMENT') {
      const legacyReports = await db.employee.findMany({
        where: {
          manager_id: user.employeeId,
          deleted_at: null,
        },
        select: { id: true },
      });
      for (const employee of legacyReports) ids.add(employee.id);
    }

    return [...ids];
  },

  async canAccessEmployee(user: AuthUser, employeeId: number, options: { forAssessment?: boolean } = {}): Promise<boolean> {
    const accessibleIds = await this.getAccessibleEmployeeIds(user, options);
    return accessibleIds.includes(employeeId);
  },
};
