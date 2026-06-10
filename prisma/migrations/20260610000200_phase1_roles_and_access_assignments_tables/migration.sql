-- Phase 1 RBAC/ABAC foundation:
-- - keep existing users.role for compatibility
-- - add roles table and users.role_id for future dynamic roles
-- - add department and line-manager assignment scopes
-- - backfill from existing users.role and employees.manager_id

CREATE TABLE IF NOT EXISTS "roles" (
  "id" SERIAL NOT NULL,
  "code" "Role" NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "is_system" BOOLEAN NOT NULL DEFAULT true,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "roles_code_key" ON "roles"("code");

INSERT INTO "roles" ("code", "name", "description", "is_system", "is_active", "sort_order", "updated_at")
VALUES
  ('ADMIN', 'Admin', 'System configuration and administration.', true, true, 1, CURRENT_TIMESTAMP),
  ('TOP_MANAGEMENT', 'Top Management', 'Leadership access to assigned departments.', true, true, 2, CURRENT_TIMESTAMP),
  ('MANAGER', 'Manager', 'Department manager with assignment-scoped access.', true, true, 3, CURRENT_TIMESTAMP),
  ('LINE_MANAGER', 'Line Manager', 'Direct manager for assigned employees across departments.', true, true, 4, CURRENT_TIMESTAMP),
  ('ENGINEER', 'Engineer', 'Own record and own assessment access.', true, true, 5, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "sort_order" = EXCLUDED."sort_order",
  "updated_at" = CURRENT_TIMESTAMP;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role_id" INTEGER;

UPDATE "users" u
SET "role_id" = r."id"
FROM "roles" r
WHERE r."code" = u."role"
  AND u."role_id" IS NULL;

CREATE INDEX IF NOT EXISTS "users_role_id_idx" ON "users"("role_id");

ALTER TABLE "users"
  ADD CONSTRAINT "users_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "roles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "user_department_assignments" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "department_id" INTEGER NOT NULL,
  "assignment_type" TEXT NOT NULL DEFAULT 'MANAGER',
  "can_view" BOOLEAN NOT NULL DEFAULT true,
  "can_manage" BOOLEAN NOT NULL DEFAULT false,
  "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ends_at" TIMESTAMP(3),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_department_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_department_assignments_user_id_department_id_assignment_t_key"
  ON "user_department_assignments"("user_id", "department_id", "assignment_type");
CREATE INDEX IF NOT EXISTS "user_department_assignments_user_id_idx" ON "user_department_assignments"("user_id");
CREATE INDEX IF NOT EXISTS "user_department_assignments_department_id_idx" ON "user_department_assignments"("department_id");
CREATE INDEX IF NOT EXISTS "user_department_assignments_is_active_idx" ON "user_department_assignments"("is_active");

ALTER TABLE "user_department_assignments"
  ADD CONSTRAINT "user_department_assignments_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_department_assignments"
  ADD CONSTRAINT "user_department_assignments_department_id_fkey"
  FOREIGN KEY ("department_id") REFERENCES "departments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_department_assignments"
  ADD CONSTRAINT "user_department_assignments_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "employee_line_manager_assignments" (
  "id" SERIAL NOT NULL,
  "manager_user_id" INTEGER NOT NULL,
  "employee_id" INTEGER NOT NULL,
  "relationship_type" TEXT NOT NULL DEFAULT 'LINE_MANAGER',
  "can_view" BOOLEAN NOT NULL DEFAULT true,
  "can_assess" BOOLEAN NOT NULL DEFAULT true,
  "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ends_at" TIMESTAMP(3),
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employee_line_manager_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "employee_line_manager_assignments_manager_user_employee_rel_key"
  ON "employee_line_manager_assignments"("manager_user_id", "employee_id", "relationship_type");
CREATE INDEX IF NOT EXISTS "employee_line_manager_assignments_manager_user_id_idx" ON "employee_line_manager_assignments"("manager_user_id");
CREATE INDEX IF NOT EXISTS "employee_line_manager_assignments_employee_id_idx" ON "employee_line_manager_assignments"("employee_id");
CREATE INDEX IF NOT EXISTS "employee_line_manager_assignments_is_active_idx" ON "employee_line_manager_assignments"("is_active");

ALTER TABLE "employee_line_manager_assignments"
  ADD CONSTRAINT "employee_line_manager_assignments_manager_user_id_fkey"
  FOREIGN KEY ("manager_user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_line_manager_assignments"
  ADD CONSTRAINT "employee_line_manager_assignments_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_line_manager_assignments"
  ADD CONSTRAINT "employee_line_manager_assignments_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Direct-report backfill. This preserves current manager behavior.
INSERT INTO "employee_line_manager_assignments" (
  "manager_user_id", "employee_id", "relationship_type", "can_view", "can_assess", "is_primary", "is_active", "updated_at"
)
SELECT manager_user."id", employee."id", 'LINE_MANAGER', true, true, true, true, CURRENT_TIMESTAMP
FROM "employees" employee
JOIN "users" manager_user ON manager_user."employee_id" = employee."manager_id"
WHERE employee."manager_id" IS NOT NULL
  AND employee."deleted_at" IS NULL
ON CONFLICT ("manager_user_id", "employee_id", "relationship_type") DO NOTHING;

-- Department-scope backfill based on departments of current direct reports.
INSERT INTO "user_department_assignments" (
  "user_id", "department_id", "assignment_type", "can_view", "can_manage", "is_active", "updated_at"
)
SELECT DISTINCT manager_user."id", employee."department_id", 'MANAGER', true, true, true, CURRENT_TIMESTAMP
FROM "employees" employee
JOIN "users" manager_user ON manager_user."employee_id" = employee."manager_id"
WHERE employee."manager_id" IS NOT NULL
  AND employee."department_id" IS NOT NULL
  AND employee."deleted_at" IS NULL
ON CONFLICT ("user_id", "department_id", "assignment_type") DO NOTHING;
