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
  CreateCompetencyCategoryInput,
  UpdateCompetencyCategoryInput,
  UpsertDomainGradeWeightInput,
} from './config.schema';

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
