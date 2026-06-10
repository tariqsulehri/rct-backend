-- A line manager cannot manage their own employee record.
-- Deactivate any legacy rows created before the application-level validation existed.

UPDATE "employee_line_manager_assignments" assignment
SET
  "is_active" = false,
  "ends_at" = COALESCE(assignment."ends_at", CURRENT_TIMESTAMP),
  "updated_at" = CURRENT_TIMESTAMP
FROM "users" manager_user
WHERE manager_user."id" = assignment."manager_user_id"
  AND manager_user."employee_id" = assignment."employee_id"
  AND assignment."is_active" = true;
