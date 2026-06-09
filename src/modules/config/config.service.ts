import { db } from '../../config/database';
import bcryptjs from 'bcryptjs';
import {
  CreateUserInput,
  UpdateUserInput,
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
} from './config.schema';

const DEFAULT_ASSESSMENT_TYPE_CONFIGS = [
  {
    code: 'Primary',
    label: 'Primary',
    weight: 0.25,
    description: 'Main technology for the competency. Gives highest credit.',
    sort_order: 1,
    is_active: true,
  },
  {
    code: 'Secondary',
    label: 'Secondary',
    weight: 0.15,
    description: 'Supporting technology. Gives medium credit.',
    sort_order: 2,
    is_active: true,
  },
  {
    code: 'Tertiary',
    label: 'Tertiary',
    weight: 0.10,
    description: 'Related technology. Gives lower credit.',
    sort_order: 3,
    is_active: true,
  },
];

const DEFAULT_ASSESSMENT_LEVEL_CONFIGS = [
  { code: 'Expert', label: 'Expert', weight: 1.00, threshold: 0.80, description: 'Deep independent ownership and expert-level execution.', sort_order: 1, is_active: true },
  { code: 'Advanced', label: 'Advanced', weight: 0.80, threshold: 0.60, description: 'Strong practical skill with limited guidance needed.', sort_order: 2, is_active: true },
  { code: 'Proficient', label: 'Proficient', weight: 0.60, threshold: 0.40, description: 'Working proficiency for delivery tasks.', sort_order: 3, is_active: true },
  { code: 'Foundational', label: 'Foundational', weight: 0.40, threshold: 0.20, description: 'Basic working understanding with support needed.', sort_order: 4, is_active: true },
  { code: 'Beginner', label: 'Beginner', weight: 0.40, threshold: 0.20, description: 'Early-stage skill exposure.', sort_order: 5, is_active: true },
  { code: 'Awareness', label: 'Awareness', weight: 0.20, threshold: 0.01, description: 'Conceptual awareness or light exposure.', sort_order: 6, is_active: true },
  { code: 'Unset', label: 'Unset', weight: 0.00, threshold: 0.00, description: 'No level selected yet.', sort_order: 7, is_active: true },
];

const DEFAULT_ASSESSMENT_STATUS_CONFIGS = [
  { code: 'approved', label: 'Approved', description: 'Manager-approved assessment. Counts toward competency and report scores.', counts_toward_score: true, is_terminal: true, sort_order: 1, is_active: true },
  { code: 'pending', label: 'Pending', description: 'Submitted assessment waiting for manager approval. Does not count toward scores.', counts_toward_score: false, is_terminal: false, sort_order: 2, is_active: true },
  { code: 'rejected', label: 'Rejected', description: 'Assessment rejected during review. Does not count toward scores.', counts_toward_score: false, is_terminal: true, sort_order: 3, is_active: true },
  { code: 'draft', label: 'Draft', description: 'Unsubmitted or in-progress assessment. Does not count toward scores.', counts_toward_score: false, is_terminal: false, sort_order: 4, is_active: true },
];

const DEFAULT_ASSESSMENT_PROJECT_CONFIGS = [
  { project_count: 0, label: '0 projects', description: 'No project delivery experience yet.', duration_months_min: 0, duration_months_max: 0, credit: 0, threshold: 0, sort_order: 1, is_active: true },
  { project_count: 1, label: '1 project', description: 'Used in at least one real project.', duration_months_min: 1, duration_months_max: 3, credit: 1 / 3, threshold: 0.25, sort_order: 2, is_active: true },
  { project_count: 2, label: '2 projects', description: 'Used across two real projects.', duration_months_min: 3, duration_months_max: 6, credit: 2 / 3, threshold: 0.50, sort_order: 3, is_active: true },
  { project_count: 3, label: '3+ projects', description: 'Used in three or more real projects. This is the scoring cap.', duration_months_min: 6, duration_months_max: null, credit: 1, threshold: 0.75, sort_order: 4, is_active: true },
];

const DEFAULT_ORGANIZATION = {
  name: 'tkxel',
  slug: 'tkxel',
  logo_url: '/assets/organizations/tkxel-logo.svg',
  base_url: 'https://tkxel.com',
};

async function getDefaultOrganizationId(): Promise<number> {
  const organization = await db.organization.upsert({
    where: { slug: DEFAULT_ORGANIZATION.slug },
    update: DEFAULT_ORGANIZATION,
    create: DEFAULT_ORGANIZATION,
  });
  return organization.id;
}

export const configService = {
  // ── Assessment Types ──────────────────────────────────────────────────────
  async ensureAssessmentTypeConfigs() {
    await Promise.all(DEFAULT_ASSESSMENT_TYPE_CONFIGS.map((type) =>
      db.assessmentTypeConfig.upsert({
        where: { code: type.code },
        create: type,
        update: {},
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
        update: {},
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
        update: {},
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
        update: {},
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
    return db.user.findMany({
      include: { employee: true },
      orderBy: { created_at: 'desc' },
    });
  },

  async createUser(data: CreateUserInput) {
    const hashed = await bcryptjs.hash(data.password, 12);
    return db.user.create({
      data: {
        username: data.username,
        password_hash: hashed,
        role: data.role,
        employee_id: data.employee_id,
        is_active: true,
      },
    });
  },

  async updateUser(id: number, data: UpdateUserInput) {
    const updateData: Record<string, unknown> = { ...data };
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

  // ── Department Config (scoring values) ─────────────────────────────────────
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
    const { category_id, domain_ids, ...rest } = data as any;
    const comp = await db.competency.create({
      data: { ...rest, category_id },
    });
    if (Array.isArray(domain_ids) && domain_ids.length > 0) {
      await db.competencyDomainMap.createMany({
        data: domain_ids.map((domain_id: number, i: number) => ({
          competency_id: comp.id,
          domain_id,
          is_primary: i === 0,
        })),
      });
    }
    return comp;
  },

  async updateCompetency(id: number, data: UpdateCompetencyInput) {
    const { category_id, domain_ids, ...rest } = data as any;
    const comp = await db.competency.update({
      where: { id },
      data: { ...rest, ...(category_id !== undefined ? { category_id } : {}) },
    });
    if (Array.isArray(domain_ids)) {
      await db.competencyDomainMap.deleteMany({ where: { competency_id: id } });
      if (domain_ids.length > 0) {
        await db.competencyDomainMap.createMany({
          data: domain_ids.map((domain_id: number, i: number) => ({
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
