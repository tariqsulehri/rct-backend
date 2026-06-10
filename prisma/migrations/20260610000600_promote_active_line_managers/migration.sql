-- Users with active line-manager assignments need line-manager access.
-- Keep higher access roles unchanged; only promote engineer logins that now
-- actively manage employees.

UPDATE "users" manager
SET
  "role" = 'LINE_MANAGER',
  "role_id" = line_manager_role."id",
  "updated_at" = CURRENT_TIMESTAMP
FROM "roles" line_manager_role
WHERE line_manager_role."code" = 'LINE_MANAGER'
  AND manager."role" = 'ENGINEER'
  AND manager."is_active" = true
  AND EXISTS (
    SELECT 1
    FROM "employee_line_manager_assignments" assignment
    WHERE assignment."manager_user_id" = manager."id"
      AND assignment."is_active" = true
      AND assignment."can_view" = true
      AND assignment."starts_at" <= CURRENT_TIMESTAMP
      AND (assignment."ends_at" IS NULL OR assignment."ends_at" >= CURRENT_TIMESTAMP)
  );
