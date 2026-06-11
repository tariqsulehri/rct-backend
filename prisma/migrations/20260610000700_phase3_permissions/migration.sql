-- Phase 3 permission system.
-- Roles remain the business persona; permissions define what each role can do.

CREATE TABLE IF NOT EXISTS "permissions" (
  "id" SERIAL NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL DEFAULT 'General',
  "is_system" BOOLEAN NOT NULL DEFAULT true,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "permissions_code_key" ON "permissions"("code");
CREATE INDEX IF NOT EXISTS "permissions_category_idx" ON "permissions"("category");
CREATE INDEX IF NOT EXISTS "permissions_is_active_idx" ON "permissions"("is_active");

CREATE TABLE IF NOT EXISTS "role_permissions" (
  "id" SERIAL NOT NULL,
  "role_id" INTEGER NOT NULL,
  "permission_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "role_permissions_role_id_permission_id_key"
  ON "role_permissions"("role_id", "permission_id");
CREATE INDEX IF NOT EXISTS "role_permissions_role_id_idx" ON "role_permissions"("role_id");
CREATE INDEX IF NOT EXISTS "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

ALTER TABLE "role_permissions"
  ADD CONSTRAINT "role_permissions_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "roles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "role_permissions"
  ADD CONSTRAINT "role_permissions_permission_id_fkey"
  FOREIGN KEY ("permission_id") REFERENCES "permissions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "permissions" ("code", "name", "description", "category", "is_system", "is_active", "sort_order", "updated_at")
VALUES
  ('config.manage', 'Manage Configuration', 'Create and update system configuration.', 'Configuration', true, true, 10, CURRENT_TIMESTAMP),
  ('users.manage', 'Manage Users', 'Create, update, activate, and deactivate login users.', 'Configuration', true, true, 20, CURRENT_TIMESTAMP),
  ('roles.manage', 'Manage Roles', 'Update role descriptions, status, and role permissions.', 'Configuration', true, true, 30, CURRENT_TIMESTAMP),
  ('assignments.manage', 'Manage Access Assignments', 'Manage department and line-manager access assignments.', 'Access', true, true, 40, CURRENT_TIMESTAMP),
  ('reports.view', 'View Reports', 'View dashboards and reporting data within assigned scope.', 'Reports', true, true, 50, CURRENT_TIMESTAMP),
  ('employees.view', 'View Employees', 'View employee records within assigned scope.', 'Employees', true, true, 60, CURRENT_TIMESTAMP),
  ('employees.manage', 'Manage Employees', 'Create, update, and archive employee records.', 'Employees', true, true, 70, CURRENT_TIMESTAMP),
  ('assessments.manage', 'Manage Assessments', 'Create and update assessments within assigned scope.', 'Assessments', true, true, 80, CURRENT_TIMESTAMP),
  ('assessments.approve', 'Approve Assessments', 'Approve assessments within assigned scope.', 'Assessments', true, true, 90, CURRENT_TIMESTAMP),
  ('self.view', 'View Own Profile', 'View own employee profile and readiness data.', 'Self Service', true, true, 100, CURRENT_TIMESTAMP),
  ('self.assessment_submit', 'Submit Own Assessment', 'Submit or update own assessment entries when allowed.', 'Self Service', true, true, 110, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "sort_order" = EXCLUDED."sort_order",
  "is_active" = true,
  "updated_at" = CURRENT_TIMESTAMP;

WITH role_permission_map(role_code, permission_code) AS (
  VALUES
    ('ADMIN', 'config.manage'),
    ('ADMIN', 'users.manage'),
    ('ADMIN', 'roles.manage'),
    ('ADMIN', 'assignments.manage'),
    ('ADMIN', 'reports.view'),
    ('ADMIN', 'employees.view'),
    ('ADMIN', 'employees.manage'),
    ('ADMIN', 'assessments.manage'),
    ('ADMIN', 'assessments.approve'),
    ('ADMIN', 'self.view'),
    ('ADMIN', 'self.assessment_submit'),

    ('TOP_MANAGEMENT', 'reports.view'),
    ('TOP_MANAGEMENT', 'employees.view'),
    ('TOP_MANAGEMENT', 'assessments.manage'),
    ('TOP_MANAGEMENT', 'assessments.approve'),
    ('TOP_MANAGEMENT', 'self.view'),

    ('MANAGER', 'reports.view'),
    ('MANAGER', 'employees.view'),
    ('MANAGER', 'assessments.manage'),
    ('MANAGER', 'assessments.approve'),
    ('MANAGER', 'self.view'),

    ('LINE_MANAGER', 'reports.view'),
    ('LINE_MANAGER', 'employees.view'),
    ('LINE_MANAGER', 'assessments.manage'),
    ('LINE_MANAGER', 'assessments.approve'),
    ('LINE_MANAGER', 'self.view'),

    ('ENGINEER', 'self.view'),
    ('ENGINEER', 'self.assessment_submit')
)
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT role_ref."id", permission_ref."id"
FROM role_permission_map
JOIN "roles" role_ref ON role_ref."code" = role_permission_map.role_code::"Role"
JOIN "permissions" permission_ref ON permission_ref."code" = role_permission_map.permission_code
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
