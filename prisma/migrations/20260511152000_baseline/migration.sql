-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'ENGINEER');

-- CreateTable
CREATE TABLE "grades" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "experience_years" INTEGER NOT NULL,
    "performance_note" TEXT,

    CONSTRAINT "grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_domains" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,

    CONSTRAINT "skill_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_domain_grade_weights" (
    "id" SERIAL NOT NULL,
    "domain_id" INTEGER NOT NULL,
    "grade_id" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "skill_domain_grade_weights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,

    CONSTRAINT "competency_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_domain_maps" (
    "id" SERIAL NOT NULL,
    "competency_id" INTEGER NOT NULL,
    "domain_id" INTEGER NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competency_domain_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competencies" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "is_critical" BOOLEAN NOT NULL DEFAULT false,
    "category_id" INTEGER NOT NULL,

    CONSTRAINT "competencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_levels" (
    "id" SERIAL NOT NULL,
    "competency_id" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "descriptor" JSONB NOT NULL,

    CONSTRAINT "competency_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technologies" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "competency_id" INTEGER NOT NULL,

    CONSTRAINT "technologies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_configs" (
    "id" SERIAL NOT NULL,
    "department_id" INTEGER NOT NULL,
    "primary_weight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "secondary_weight" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "tertiary_weight" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "use_custom_grade_matrix" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_domain_weights" (
    "id" SERIAL NOT NULL,
    "department_id" INTEGER NOT NULL,
    "domain_id" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0.142857,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "department_domain_weights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade_matrix" (
    "id" SERIAL NOT NULL,
    "grade_id" INTEGER NOT NULL,
    "competency_id" INTEGER NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "grade_matrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "password_reset_token" TEXT,
    "reset_token_expires" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" SERIAL NOT NULL,
    "emp_code" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "email" TEXT,
    "current_grade_id" INTEGER NOT NULL,
    "target_grade_id" INTEGER NOT NULL,
    "manager_id" INTEGER,
    "department_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_assessments" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "technology_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "projects" INTEGER NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'Unset',
    "score" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "assessed_by" INTEGER NOT NULL,
    "assessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_scores" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "competency_id" INTEGER NOT NULL,
    "score" DOUBLE PRECISION,
    "level_label" TEXT,
    "star_rating" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competency_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domain_scores" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "domain_id" INTEGER NOT NULL,
    "score" DOUBLE PRECISION,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domain_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "grades_code_key" ON "grades"("code");

-- CreateIndex
CREATE INDEX "grades_level_idx" ON "grades"("level");

-- CreateIndex
CREATE UNIQUE INDEX "skill_domains_name_key" ON "skill_domains"("name");

-- CreateIndex
CREATE INDEX "skill_domain_grade_weights_domain_id_idx" ON "skill_domain_grade_weights"("domain_id");

-- CreateIndex
CREATE INDEX "skill_domain_grade_weights_grade_id_idx" ON "skill_domain_grade_weights"("grade_id");

-- CreateIndex
CREATE UNIQUE INDEX "skill_domain_grade_weights_domain_id_grade_id_key" ON "skill_domain_grade_weights"("domain_id", "grade_id");

-- CreateIndex
CREATE UNIQUE INDEX "competency_categories_name_key" ON "competency_categories"("name");

-- CreateIndex
CREATE INDEX "competency_domain_maps_competency_id_idx" ON "competency_domain_maps"("competency_id");

-- CreateIndex
CREATE INDEX "competency_domain_maps_domain_id_idx" ON "competency_domain_maps"("domain_id");

-- CreateIndex
CREATE UNIQUE INDEX "competency_domain_maps_competency_id_domain_id_key" ON "competency_domain_maps"("competency_id", "domain_id");

-- CreateIndex
CREATE UNIQUE INDEX "competencies_name_key" ON "competencies"("name");

-- CreateIndex
CREATE INDEX "competencies_category_id_idx" ON "competencies"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "competency_levels_competency_id_level_key" ON "competency_levels"("competency_id", "level");

-- CreateIndex
CREATE INDEX "technologies_competency_id_idx" ON "technologies"("competency_id");

-- CreateIndex
CREATE UNIQUE INDEX "technologies_name_competency_id_key" ON "technologies"("name", "competency_id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "department_configs_department_id_key" ON "department_configs"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "department_domain_weights_department_id_domain_id_key" ON "department_domain_weights"("department_id", "domain_id");

-- CreateIndex
CREATE INDEX "grade_matrix_grade_id_idx" ON "grade_matrix"("grade_id");

-- CreateIndex
CREATE INDEX "grade_matrix_competency_id_idx" ON "grade_matrix"("competency_id");

-- CreateIndex
CREATE UNIQUE INDEX "grade_matrix_grade_id_competency_id_key" ON "grade_matrix"("grade_id", "competency_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_id_key" ON "users"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_password_reset_token_key" ON "users"("password_reset_token");

-- CreateIndex
CREATE INDEX "users_employee_id_idx" ON "users"("employee_id");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_emp_code_key" ON "employees"("emp_code");

-- CreateIndex
CREATE INDEX "employees_manager_id_idx" ON "employees"("manager_id");

-- CreateIndex
CREATE INDEX "employees_current_grade_id_idx" ON "employees"("current_grade_id");

-- CreateIndex
CREATE INDEX "employees_deleted_at_idx" ON "employees"("deleted_at");

-- CreateIndex
CREATE INDEX "employees_department_id_idx" ON "employees"("department_id");

-- CreateIndex
CREATE INDEX "skill_assessments_employee_id_idx" ON "skill_assessments"("employee_id");

-- CreateIndex
CREATE INDEX "skill_assessments_technology_id_idx" ON "skill_assessments"("technology_id");

-- CreateIndex
CREATE UNIQUE INDEX "skill_assessments_employee_id_technology_id_key" ON "skill_assessments"("employee_id", "technology_id");

-- CreateIndex
CREATE INDEX "competency_scores_employee_id_idx" ON "competency_scores"("employee_id");

-- CreateIndex
CREATE INDEX "competency_scores_competency_id_idx" ON "competency_scores"("competency_id");

-- CreateIndex
CREATE UNIQUE INDEX "competency_scores_employee_id_competency_id_key" ON "competency_scores"("employee_id", "competency_id");

-- CreateIndex
CREATE INDEX "domain_scores_employee_id_idx" ON "domain_scores"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "domain_scores_employee_id_domain_id_key" ON "domain_scores"("employee_id", "domain_id");

-- AddForeignKey
ALTER TABLE "skill_domain_grade_weights" ADD CONSTRAINT "skill_domain_grade_weights_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "skill_domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_domain_grade_weights" ADD CONSTRAINT "skill_domain_grade_weights_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_domain_maps" ADD CONSTRAINT "competency_domain_maps_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_domain_maps" ADD CONSTRAINT "competency_domain_maps_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "skill_domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "competency_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_levels" ADD CONSTRAINT "competency_levels_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technologies" ADD CONSTRAINT "technologies_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_configs" ADD CONSTRAINT "department_configs_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_domain_weights" ADD CONSTRAINT "department_domain_weights_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_domain_weights" ADD CONSTRAINT "department_domain_weights_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "skill_domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_matrix" ADD CONSTRAINT "grade_matrix_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_matrix" ADD CONSTRAINT "grade_matrix_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_current_grade_id_fkey" FOREIGN KEY ("current_grade_id") REFERENCES "grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_target_grade_id_fkey" FOREIGN KEY ("target_grade_id") REFERENCES "grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_assessments" ADD CONSTRAINT "skill_assessments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_assessments" ADD CONSTRAINT "skill_assessments_technology_id_fkey" FOREIGN KEY ("technology_id") REFERENCES "technologies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_scores" ADD CONSTRAINT "competency_scores_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_scores" ADD CONSTRAINT "competency_scores_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domain_scores" ADD CONSTRAINT "domain_scores_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domain_scores" ADD CONSTRAINT "domain_scores_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "skill_domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

