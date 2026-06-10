import { db } from '../../config/database';
import bcryptjs from 'bcryptjs';
import {
  CreateUserInput,
  UpdateUserInput,
  UpdateRoleInput,
  CreateDepartmentAssignmentInput,
  UpdateDepartmentAssignmentInput,
  CreateLineManagerAssignmentInput,
  UpdateLineManagerAssignmentInput,
  CreateEmployeeInput,
  UpdateEmployeeInput,
  CreateGradeInput,
  UpdateGradeInput,
  CreateSkillDomainInput,
  UpdateSkillDomainInput,
  CreateCompetencyInput,
  UpdateCompetencyInput,
  CreateTechnologyInput,
  UpdateTechnologyInput,
  CreateDepartmentInput,
  UpdateDepartmentInput,
  UpsertDepartmentConfigInput,
  BulkUpsertDomainWeightsInput,
  UpdateAssessmentTypeConfigInput,
  UpdateAssessmentLevelConfigInput,
  UpdateAssessmentStatusConfigInput,
  UpdateAssessmentProjectConfigInput,
  CreateCompetencyCategoryInput,
  UpdateCompetencyCategoryInput,
  UpsertDomainGradeWeightInput,
  UpsertCompetencyGradeThresholdInput,
  BulkUpsertCompetencyGradeThresholdsInput,
} from './config.schema';

const DEFAULT_ASSESSMENT_TYPE_CONFIGS = [
  {
    code: 'Primary',
    label: 'Primary',
    weight: 0.25,
    description: 'Base score is the starting score. Example: Primary 0.25 gives more score than Secondary 0.15.',
    sort_order: 1,
    is_active: true,
  },
  {
    code: 'Secondary',
    label: 'Secondary',
    weight: 0.15,
    description: 'Base score is the starting score. Example: Secondary 0.15 gives medium score.',
    sort_order: 2,
    is_active: true,
  },
  {
    code: 'Tertiary',
    label: 'Tertiary',
    weight: 0.10,
    description: 'Base score is the starting score. Example: Tertiary 0.10 gives lower score.',
    sort_order: 3,
    is_active: true,
  },
];

const DEFAULT_ASSESSMENT_LEVEL_CONFIGS = [
  { code: 'Expert', label: 'Expert', weight: 1.00, threshold: 0.80, description: 'Base score multiplies skill score; minimum target shows the expected skill level. Example: 1.00 Base score, 0.80 target.', sort_order: 1, is_active: true },
  { code: 'Advanced', label: 'Advanced', weight: 0.80, threshold: 0.60, description: 'Base score multiplies skill score; minimum target shows the expected skill level. Example: 0.80 Base score, 0.60 target.', sort_order: 2, is_active: true },
  { code: 'Proficient', label: 'Proficient', weight: 0.60, threshold: 0.40, description: 'Base score multiplies skill score; minimum target shows the expected skill level. Example: 0.60 Base score, 0.40 target.', sort_order: 3, is_active: true },
  { code: 'Foundational', label: 'Foundational', weight: 0.40, threshold: 0.20, description: 'Base score multiplies skill score; minimum target shows the expected skill level. Example: 0.40 Base score, 0.20 target.', sort_order: 4, is_active: true },
  { code: 'Beginner', label: 'Beginner', weight: 0.40, threshold: 0.20, description: 'Base score multiplies skill score; minimum target shows the expected skill level. Example: 0.40 Base score, 0.20 target.', sort_order: 5, is_active: true },
  { code: 'Awareness', label: 'Awareness', weight: 0.20, threshold: 0.01, description: 'Base score gives light score; minimum target marks basic recognition. Example: 0.20 Base score, 0.01 target.', sort_order: 6, is_active: true },
  { code: 'Unset', label: 'Unset', weight: 0.00, threshold: 0.00, description: 'No selected level. Base score 0.00 means it adds no score; minimum target 0.00 means no target.', sort_order: 7, is_active: true },
];

const DEFAULT_ASSESSMENT_STATUS_CONFIGS = [
  { code: 'approved', label: 'Approved', description: 'Affects score is Yes, so this assessment affects calculations. Review complete means no more action is needed.', counts_toward_score: true, is_terminal: true, sort_order: 1, is_active: true },
  { code: 'pending', label: 'Pending', description: 'Affects score is No until approved. Review complete is No because manager review is still open.', counts_toward_score: false, is_terminal: false, sort_order: 2, is_active: true },
  { code: 'rejected', label: 'Rejected', description: 'Affects score is No. Review complete means the review is closed and will not affect score.', counts_toward_score: false, is_terminal: true, sort_order: 3, is_active: true },
  { code: 'draft', label: 'Draft', description: 'Affects score is No. Review complete is No because the assessment is still being prepared.', counts_toward_score: false, is_terminal: false, sort_order: 4, is_active: true },
];

const DEFAULT_ASSESSMENT_PROJECT_CONFIGS = [
  { project_count: 0, label: '0 projects', description: 'Project score adds delivery experience to the score; minimum target is the expected project exposure. Example: 0 projects gives 0 project score, 0 target.', duration_months_min: 0, duration_months_max: 0, credit: 0, threshold: 0, sort_order: 1, is_active: true },
  { project_count: 1, label: '1 project', description: 'Project score adds delivery experience to the score; minimum target is the expected project exposure. Example: 1 project gives 0.33 project score, 0.25 target.', duration_months_min: 1, duration_months_max: 3, credit: 1 / 3, threshold: 0.25, sort_order: 2, is_active: true },
  { project_count: 2, label: '2 projects', description: 'Project score adds delivery experience to the score; minimum target is the expected project exposure. Example: 2 projects gives 0.67 project score, 0.50 target.', duration_months_min: 3, duration_months_max: 6, credit: 2 / 3, threshold: 0.50, sort_order: 3, is_active: true },
  { project_count: 3, label: '3+ projects', description: 'Project score adds delivery experience to the score; minimum target is the expected project exposure. Example: 3+ projects gives 1.00 project score, 0.75 target.', duration_months_min: 6, duration_months_max: null, credit: 1, threshold: 0.75, sort_order: 4, is_active: true },
];

const DEFAULT_ORGANIZATION = {
  name: 'tkxel',
  slug: 'tkxel',
  logo_url: '/assets/organizations/tkxel-logo.svg',
  base_url: 'https://tkxel.com',
};

const DEFAULT_ROLES = [
  { code: 'ADMIN' as const, name: 'Admin', description: 'System configuration and administration.', sort_order: 1 },
  { code: 'TOP_MANAGEMENT' as const, name: 'Top Management', description: 'Leadership access to assigned departments.', sort_order: 2 },
  { code: 'MANAGER' as const, name: 'Manager', description: 'Department manager with assignment-scoped access.', sort_order: 3 },
  { code: 'LINE_MANAGER' as const, name: 'Line Manager', description: 'Direct manager for assigned employees across departments.', sort_order: 4 },
  { code: 'ENGINEER' as const, name: 'Engineer', description: 'Own record and own assessment access.', sort_order: 5 },
];

async function getDefaultOrganizationId(): Promise<number> {
  const organization = await db.organization.upsert({
    where: { slug: DEFAULT_ORGANIZATION.slug },
    update: DEFAULT_ORGANIZATION,
    create: DEFAULT_ORGANIZATION,
  });
  return organization.id;
}

async function getDefaultDepartmentId(): Promise<number> {
  const organizationId = await getDefaultOrganizationId();
  const department = await db.department.upsert({
    where: { organization_id_name: { organization_id: organizationId, name: 'DevOps' } },
    update: {},
    create: {
      organization_id: organizationId,
      name: 'DevOps',
      description: 'Default department for the current DevOps scoring data.',
    },
  });
  return department.id;
}

export const configService = {
  // ── Roles ─────────────────────────────────────────────────────────────────
  async ensureRoles() {
    await Promise.all(DEFAULT_ROLES.map((role) =>
      db.accessRole.upsert({
        where: { code: role.code },
        create: { ...role, is_system: true, is_active: true },
        update: { name: role.name, description: role.description, sort_order: role.sort_order, is_active: true },
      })
    ));
  },

  async listRoles() {
    await this.ensureRoles();
    return db.accessRole.findMany({
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });
  },

  async updateRole(id: number, data: UpdateRoleInput, actorUserId?: number) {
    const before = await db.accessRole.findUnique({ where: { id } });
    const updated = await db.accessRole.update({ where: { id }, data });
    await this.createAccessAuditLog({
      actorUserId,
      targetUserId: null,
      roleId: updated.id,
      action: 'UPDATE_ROLE',
      entityType: 'role',
      entityId: updated.id,
      oldValue: before,
      newValue: updated,
    });
    return updated;
  },

  async createAccessAuditLog(input: {
    actorUserId?: number | null;
    targetUserId?: number | null;
    roleId?: number | null;
    action: string;
    entityType: string;
    entityId?: number | null;
    oldValue?: unknown;
    newValue?: unknown;
  }) {
    return db.accessAuditLog.create({
      data: {
        actor_user_id: input.actorUserId ?? null,
        target_user_id: input.targetUserId ?? null,
        role_id: input.roleId ?? null,
        action: input.action,
        entity_type: input.entityType,
        entity_id: input.entityId ?? null,
        old_value: input.oldValue === undefined ? undefined : input.oldValue as any,
        new_value: input.newValue === undefined ? undefined : input.newValue as any,
      },
    });
  },

  async listAccessAuditLogs() {
    return db.accessAuditLog.findMany({
      include: {
        actor_user: { include: { employee: true } },
        target_user: { include: { employee: true } },
        role: true,
      },
      orderBy: { created_at: 'desc' },
      take: 100,
    });
  },

  async listDepartmentAssignments() {
    return db.userDepartmentAssignment.findMany({
      include: {
        user: { include: { employee: true, role_ref: true } },
        department: true,
        creator: { include: { employee: true } },
      },
      orderBy: [{ is_active: 'desc' }, { department: { name: 'asc' } }, { user: { username: 'asc' } }],
    });
  },

  async createDepartmentAssignment(data: CreateDepartmentAssignmentInput, actorUserId?: number) {
    const created = await db.userDepartmentAssignment.upsert({
      where: {
        user_id_department_id_assignment_type: {
          user_id: data.user_id,
          department_id: data.department_id,
          assignment_type: data.assignment_type,
        },
      },
      create: { ...data, created_by: actorUserId },
      update: { ...data, created_by: actorUserId },
      include: {
        user: { include: { employee: true, role_ref: true } },
        department: true,
        creator: { include: { employee: true } },
      },
    });
    await this.createAccessAuditLog({
      actorUserId,
      targetUserId: created.user_id,
      action: 'UPSERT_DEPARTMENT_ASSIGNMENT',
      entityType: 'user_department_assignment',
      entityId: created.id,
      newValue: created,
    });
    return created;
  },

  async updateDepartmentAssignment(id: number, data: UpdateDepartmentAssignmentInput, actorUserId?: number) {
    const before = await db.userDepartmentAssignment.findUnique({ where: { id } });
    const updated = await db.userDepartmentAssignment.update({
      where: { id },
      data,
      include: {
        user: { include: { employee: true, role_ref: true } },
        department: true,
        creator: { include: { employee: true } },
      },
    });
    await this.createAccessAuditLog({
      actorUserId,
      targetUserId: updated.user_id,
      action: 'UPDATE_DEPARTMENT_ASSIGNMENT',
      entityType: 'user_department_assignment',
      entityId: id,
      oldValue: before,
      newValue: updated,
    });
    return updated;
  },

  async deleteDepartmentAssignment(id: number, actorUserId?: number) {
    const before = await db.userDepartmentAssignment.findUnique({ where: { id } });
    const updated = await db.userDepartmentAssignment.update({
      where: { id },
      data: { is_active: false, ends_at: new Date() },
      include: {
        user: { include: { employee: true, role_ref: true } },
        department: true,
        creator: { include: { employee: true } },
      },
    });
    await this.createAccessAuditLog({
      actorUserId,
      targetUserId: updated.user_id,
      action: 'DEACTIVATE_DEPARTMENT_ASSIGNMENT',
      entityType: 'user_department_assignment',
      entityId: id,
      oldValue: before,
      newValue: updated,
    });
    return updated;
  },

  async listLineManagerAssignments() {
    return db.employeeLineManagerAssignment.findMany({
      include: {
        manager_user: { include: { employee: true, role_ref: true } },
        employee: { include: { dept: true, current_grade: true, target_grade: true } },
        creator: { include: { employee: true } },
      },
      orderBy: [{ is_active: 'desc' }, { manager_user: { username: 'asc' } }, { employee: { full_name: 'asc' } }],
    });
  },

  async createLineManagerAssignment(data: CreateLineManagerAssignmentInput, actorUserId?: number) {
    const created = await db.employeeLineManagerAssignment.upsert({
      where: {
        manager_user_id_employee_id_relationship_type: {
          manager_user_id: data.manager_user_id,
          employee_id: data.employee_id,
          relationship_type: data.relationship_type,
        },
      },
      create: { ...data, created_by: actorUserId },
      update: { ...data, created_by: actorUserId },
      include: {
        manager_user: { include: { employee: true, role_ref: true } },
        employee: { include: { dept: true, current_grade: true, target_grade: true } },
        creator: { include: { employee: true } },
      },
    });
    await this.createAccessAuditLog({
      actorUserId,
      targetUserId: created.manager_user_id,
      action: 'UPSERT_LINE_MANAGER_ASSIGNMENT',
      entityType: 'employee_line_manager_assignment',
      entityId: created.id,
      newValue: created,
    });
    return created;
  },

  async updateLineManagerAssignment(id: number, data: UpdateLineManagerAssignmentInput, actorUserId?: number) {
    const before = await db.employeeLineManagerAssignment.findUnique({ where: { id } });
    const updated = await db.employeeLineManagerAssignment.update({
      where: { id },
      data,
      include: {
        manager_user: { include: { employee: true, role_ref: true } },
        employee: { include: { dept: true, current_grade: true, target_grade: true } },
        creator: { include: { employee: true } },
      },
    });
    await this.createAccessAuditLog({
      actorUserId,
      targetUserId: updated.manager_user_id,
      action: 'UPDATE_LINE_MANAGER_ASSIGNMENT',
      entityType: 'employee_line_manager_assignment',
      entityId: id,
      oldValue: before,
      newValue: updated,
    });
    return updated;
  },

  async deleteLineManagerAssignment(id: number, actorUserId?: number) {
    const before = await db.employeeLineManagerAssignment.findUnique({ where: { id } });
    const updated = await db.employeeLineManagerAssignment.update({
      where: { id },
      data: { is_active: false, ends_at: new Date() },
      include: {
        manager_user: { include: { employee: true, role_ref: true } },
        employee: { include: { dept: true, current_grade: true, target_grade: true } },
        creator: { include: { employee: true } },
      },
    });
    await this.createAccessAuditLog({
      actorUserId,
      targetUserId: updated.manager_user_id,
      action: 'DEACTIVATE_LINE_MANAGER_ASSIGNMENT',
      entityType: 'employee_line_manager_assignment',
      entityId: id,
      oldValue: before,
      newValue: updated,
    });
    return updated;
  },

  // ── Assessment Types ──────────────────────────────────────────────────────
  async ensureAssessmentTypeConfigs() {
    await Promise.all(DEFAULT_ASSESSMENT_TYPE_CONFIGS.map((type) =>
      db.assessmentTypeConfig.upsert({
        where: { code: type.code },
        create: type,
        update: { label: type.label, description: type.description, sort_order: type.sort_order },
      })
    ));
  },

  async listAssessmentTypeConfigs() {
    await this.ensureAssessmentTypeConfigs();
    return db.assessmentTypeConfig.findMany({
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });
  },

  async updateAssessmentTypeConfig(id: number, data: UpdateAssessmentTypeConfigInput) {
    return db.assessmentTypeConfig.update({ where: { id }, data });
  },

  async ensureAssessmentLevelConfigs() {
    await Promise.all(DEFAULT_ASSESSMENT_LEVEL_CONFIGS.map((level) =>
      db.assessmentLevelConfig.upsert({
        where: { code: level.code },
        create: level,
        update: { label: level.label, description: level.description, sort_order: level.sort_order },
      })
    ));
  },

  async listAssessmentLevelConfigs() {
    await this.ensureAssessmentLevelConfigs();
    return db.assessmentLevelConfig.findMany({
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });
  },

  async updateAssessmentLevelConfig(id: number, data: UpdateAssessmentLevelConfigInput) {
    return db.assessmentLevelConfig.update({ where: { id }, data });
  },

  async ensureAssessmentStatusConfigs() {
    await Promise.all(DEFAULT_ASSESSMENT_STATUS_CONFIGS.map((status) =>
      db.assessmentStatusConfig.upsert({
        where: { code: status.code },
        create: status,
        update: { label: status.label, description: status.description, sort_order: status.sort_order },
      })
    ));
  },

  async listAssessmentStatusConfigs() {
    await this.ensureAssessmentStatusConfigs();
    return db.assessmentStatusConfig.findMany({
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });
  },

  async updateAssessmentStatusConfig(id: number, data: UpdateAssessmentStatusConfigInput) {
    return db.assessmentStatusConfig.update({ where: { id }, data });
  },

  async ensureAssessmentProjectConfigs() {
    await Promise.all(DEFAULT_ASSESSMENT_PROJECT_CONFIGS.map((project) =>
      db.assessmentProjectConfig.upsert({
        where: { project_count: project.project_count },
        create: project,
        update: { label: project.label, description: project.description, sort_order: project.sort_order },
      })
    ));
  },

  async listAssessmentProjectConfigs() {
    await this.ensureAssessmentProjectConfigs();
    return db.assessmentProjectConfig.findMany({
      orderBy: [{ sort_order: 'asc' }, { project_count: 'asc' }],
    });
  },

  async updateAssessmentProjectConfig(id: number, data: UpdateAssessmentProjectConfigInput) {
    return db.assessmentProjectConfig.update({ where: { id }, data });
  },

  // ── Users ──────────────────────────────────────────────────────────────────
  async listUsers() {
    await this.ensureRoles();
    return db.user.findMany({
      include: { employee: true, role_ref: true },
      orderBy: { created_at: 'desc' },
    });
  },

  async createUser(data: CreateUserInput) {
    await this.ensureRoles();
    const role = await db.accessRole.findUnique({ where: { code: data.role } });
    const hashed = await bcryptjs.hash(data.password, 12);
    return db.user.create({
      data: {
        username: data.username,
        password_hash: hashed,
        role: data.role,
        role_id: role?.id,
        employee_id: data.employee_id,
        is_active: true,
      },
    });
  },

  async updateUser(id: number, data: UpdateUserInput) {
    if (data.employee_id) {
      const existing = await db.user.findFirst({
        where: {
          employee_id: data.employee_id,
          id: { not: id },
        },
        include: { employee: { select: { emp_code: true, full_name: true } } },
      });
      if (existing) {
        const employeeLabel = existing.employee
          ? `${existing.employee.emp_code} - ${existing.employee.full_name}`
          : `employee #${data.employee_id}`;
        throw Object.assign(new Error(`${employeeLabel} is already assigned to user "${existing.username}".`), {
          statusCode: 409,
          code: 'EMPLOYEE_ALREADY_ASSIGNED',
        });
      }
    }
    const updateData: Record<string, unknown> = { ...data };
    if (data.role) {
      await this.ensureRoles();
      const role = await db.accessRole.findUnique({ where: { code: data.role } });
      updateData.role_id = role?.id ?? null;
    }
    if (data.password) {
      updateData.password_hash = await bcryptjs.hash(data.password, 12);
      delete updateData.password;
    }
    return db.user.update({ where: { id }, data: updateData });
  },

  async deleteUser(id: number) {
    return db.user.update({ where: { id }, data: { is_active: false } });
  },

  // ── Competency Categories ──────────────────────────────────────────────────
  async listCompetencyCategories() {
    return db.competencyCategory.findMany({
      include: { competencies: { select: { id: true } } },
      orderBy: { name: 'asc' },
    });
  },

  async createCompetencyCategory(data: CreateCompetencyCategoryInput) {
    return db.competencyCategory.create({ data });
  },

  async updateCompetencyCategory(id: number, data: UpdateCompetencyCategoryInput) {
    return db.competencyCategory.update({ where: { id }, data });
  },

  async deleteCompetencyCategory(id: number) {
    return db.competencyCategory.delete({ where: { id } });
  },

  // ── Departments ────────────────────────────────────────────────────────────
  async listDepartments() {
    return db.department.findMany({
      include: {
        organization: true,
        employees: { where: { deleted_at: null }, select: { id: true } },
        config: true,
        domain_weights: { include: { domain: true } },
      },
      orderBy: { name: 'asc' },
    });
  },

  async getDepartment(id: number) {
    return db.department.findUnique({
      where: { id },
      include: {
        organization: true,
        config: true,
        domain_weights: { include: { domain: true } },
      },
    });
  },

  async createDepartment(data: CreateDepartmentInput) {
    const organizationId = await getDefaultOrganizationId();
    return db.department.create({ data: { ...data, organization_id: organizationId } });
  },

  async updateDepartment(id: number, data: UpdateDepartmentInput) {
    return db.department.update({ where: { id }, data });
  },

  async deleteDepartment(id: number) {
    return db.department.delete({ where: { id } });
  },

  // ── Department Config (formula weights) ────────────────────────────────────
  async upsertDepartmentConfig(departmentId: number, data: UpsertDepartmentConfigInput) {
    return db.departmentConfig.upsert({
      where: { department_id: departmentId },
      create: { department_id: departmentId, ...data },
      update: data,
    });
  },

  async getDepartmentConfig(departmentId: number) {
    return db.departmentConfig.findUnique({ where: { department_id: departmentId } });
  },

  // ── Department Domain Weights ───────────────────────────────────────────────
  async upsertDepartmentDomainWeights(departmentId: number, input: BulkUpsertDomainWeightsInput) {
    const ops = input.weights.map(w =>
      db.departmentDomainWeight.upsert({
        where: { department_id_domain_id: { department_id: departmentId, domain_id: w.domain_id } },
        create: { department_id: departmentId, domain_id: w.domain_id, weight: w.weight, is_active: w.is_active },
        update: { weight: w.weight, is_active: w.is_active },
      })
    );
    return Promise.all(ops);
  },

  async getDepartmentDomainWeights(departmentId: number) {
    return db.departmentDomainWeight.findMany({
      where: { department_id: departmentId },
      include: { domain: true },
    });
  },

  // ── Get dept config for scoring ────────────────────────────────────────────
  async getDepartmentForEmployee(employeeId: number) {
    const emp = await db.employee.findUnique({
      where: { id: employeeId },
      select: { department_id: true },
    });
    if (!emp?.department_id) return null;
    return db.department.findUnique({
      where: { id: emp.department_id },
      include: {
        config: true,
        domain_weights: true,
      },
    });
  },

  // ── Employees ──────────────────────────────────────────────────────────────
  async listEmployees() {
    return db.employee.findMany({
      where: { deleted_at: null },
      include: {
        current_grade: true,
        target_grade: true,
        organization: true,
        manager: true,
        dept: true,
      },
      orderBy: { full_name: 'asc' },
    });
  },

  async createEmployee(data: CreateEmployeeInput) {
    const organizationId = await getDefaultOrganizationId();
    return db.employee.create({
      data: {
        organization_id: organizationId,
        emp_code: data.emp_code,
        full_name: data.full_name,
        department: data.department,
        email: data.email ?? null,
        current_grade_id: data.current_grade_id,
        target_grade_id: data.target_grade_id,
        manager_id: data.manager_id ?? null,
        department_id: data.department_id ?? null,
      },
    });
  },

  async updateEmployee(id: number, data: UpdateEmployeeInput) {
    const { department_id, ...rest } = data as any;
    return db.employee.update({
      where: { id },
      data: { ...rest, department_id: department_id ?? null },
    });
  },

  async deleteEmployee(id: number) {
    return db.employee.update({ where: { id }, data: { deleted_at: new Date() } });
  },

  // ── Grades ─────────────────────────────────────────────────────────────────
  async listGrades() {
    return db.grade.findMany({ orderBy: { level: 'asc' } });
  },

  async createGrade(data: CreateGradeInput) {
    return db.grade.create({ data });
  },

  async updateGrade(id: number, data: UpdateGradeInput) {
    return db.grade.update({ where: { id }, data });
  },

  async deleteGrade(id: number) {
    return db.grade.delete({ where: { id } });
  },

  // ── Skill Domains ──────────────────────────────────────────────────────────
  async listSkillDomains() {
    return db.skillDomain.findMany({
      include: {
        competency_domains: { include: { competency: true } },
        grade_weights: { select: { grade_id: true, weight: true } },
      },
      orderBy: { name: 'asc' },
    });
  },

  async createSkillDomain(data: CreateSkillDomainInput) {
    return db.skillDomain.create({ data });
  },

  async updateSkillDomain(id: number, data: UpdateSkillDomainInput) {
    return db.skillDomain.update({ where: { id }, data });
  },

  async deleteSkillDomain(id: number) {
    return db.skillDomain.delete({ where: { id } });
  },

  // ── Domain Grade Weights ───────────────────────────────────────────────────
  async listDomainGradeWeights() {
    return db.skillDomainGradeWeight.findMany({
      include: { domain: true, grade: true },
      orderBy: [{ domain: { name: 'asc' } }, { grade: { level: 'asc' } }],
    });
  },

  async upsertDomainGradeWeight(data: UpsertDomainGradeWeightInput) {
    return db.skillDomainGradeWeight.upsert({
      where: { domain_id_grade_id: { domain_id: data.domain_id, grade_id: data.grade_id } },
      create: data,
      update: { weight: data.weight },
      include: { domain: true, grade: true },
    });
  },

  async deleteDomainGradeWeight(id: number) {
    return db.skillDomainGradeWeight.delete({ where: { id } });
  },

  // ── Competency Grade Thresholds ───────────────────────────────────────────
  async listCompetencyGradeThresholds(departmentId?: number) {
    return db.gradeMatrix.findMany({
      where: departmentId ? { department_id: departmentId } : undefined,
      include: {
        department: true,
        grade: true,
        competency: { include: { competency_domains: { include: { domain: true } } } },
      },
      orderBy: [
        { department: { name: 'asc' } },
        { competency: { name: 'asc' } },
        { grade: { level: 'asc' } },
      ],
    });
  },

  async upsertCompetencyGradeThreshold(data: UpsertCompetencyGradeThresholdInput) {
    return db.gradeMatrix.upsert({
      where: {
        department_id_grade_id_competency_id: {
          department_id: data.department_id,
          grade_id: data.grade_id,
          competency_id: data.competency_id,
        },
      },
      create: data,
      update: { threshold: data.threshold },
      include: {
        department: true,
        grade: true,
        competency: { include: { competency_domains: { include: { domain: true } } } },
      },
    });
  },

  async bulkUpsertCompetencyGradeThresholds(data: BulkUpsertCompetencyGradeThresholdsInput) {
    await db.$transaction(
      data.thresholds.map((threshold) =>
        db.gradeMatrix.upsert({
          where: {
            department_id_grade_id_competency_id: {
              department_id: data.department_id,
              grade_id: threshold.grade_id,
              competency_id: threshold.competency_id,
            },
          },
          create: { department_id: data.department_id, ...threshold },
          update: { threshold: threshold.threshold },
        })
      )
    );
    return this.listCompetencyGradeThresholds(data.department_id);
  },

  // ── Competencies ───────────────────────────────────────────────────────────
  async listCompetencies() {
    return db.competency.findMany({
      include: {
        competency_category: true,
        competency_domains: { include: { domain: true } },
        technologies: true,
      },
      orderBy: { name: 'asc' },
    });
  },

  async createCompetency(data: CreateCompetencyInput) {
    const { category_id, department_id, domain_ids, ...rest } = data as any;
    const comp = await db.competency.create({
      data: { ...rest, category_id },
    });
    const departmentId = department_id ?? await getDefaultDepartmentId();
    if (Array.isArray(domain_ids) && domain_ids.length > 0) {
      await db.competencyDomainMap.createMany({
        data: domain_ids.map((domain_id: number, i: number) => ({
          department_id: departmentId,
          competency_id: comp.id,
          domain_id,
          is_primary: i === 0,
        })),
      });
    }
    return comp;
  },

  async updateCompetency(id: number, data: UpdateCompetencyInput) {
    const { category_id, department_id, domain_ids, ...rest } = data as any;
    const comp = await db.competency.update({
      where: { id },
      data: { ...rest, ...(category_id !== undefined ? { category_id } : {}) },
    });
    if (Array.isArray(domain_ids)) {
      const departmentId = department_id ?? await getDefaultDepartmentId();
      await db.competencyDomainMap.deleteMany({ where: { competency_id: id, department_id: departmentId } });
      if (domain_ids.length > 0) {
        await db.competencyDomainMap.createMany({
          data: domain_ids.map((domain_id: number, i: number) => ({
            department_id: departmentId,
            competency_id: id,
            domain_id,
            is_primary: i === 0,
          })),
        });
      }
    }
    return comp;
  },

  async deleteCompetency(id: number) {
    return db.competency.delete({ where: { id } });
  },

  // ── Technologies ───────────────────────────────────────────────────────────
  async listTechnologies() {
    return db.technology.findMany({
      include: { competency: { include: { competency_domains: { include: { domain: true } } } } },
      orderBy: { name: 'asc' },
    });
  },

  async createTechnology(data: CreateTechnologyInput) {
    return db.technology.create({
      data: {
        name: data.name,
        competency_id: data.competency_id,
      },
    });
  },

  async updateTechnology(id: number, data: UpdateTechnologyInput) {
    return db.technology.update({ where: { id }, data });
  },

  async deleteTechnology(id: number) {
    return db.technology.delete({ where: { id } });
  },
};
