-- Phase 2 access management audit trail.

CREATE TABLE IF NOT EXISTS "access_audit_logs" (
  "id" SERIAL NOT NULL,
  "actor_user_id" INTEGER,
  "target_user_id" INTEGER,
  "role_id" INTEGER,
  "action" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" INTEGER,
  "old_value" JSONB,
  "new_value" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "access_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "access_audit_logs_actor_user_id_idx" ON "access_audit_logs"("actor_user_id");
CREATE INDEX IF NOT EXISTS "access_audit_logs_target_user_id_idx" ON "access_audit_logs"("target_user_id");
CREATE INDEX IF NOT EXISTS "access_audit_logs_role_id_idx" ON "access_audit_logs"("role_id");
CREATE INDEX IF NOT EXISTS "access_audit_logs_entity_type_entity_id_idx" ON "access_audit_logs"("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "access_audit_logs_created_at_idx" ON "access_audit_logs"("created_at");

ALTER TABLE "access_audit_logs"
  ADD CONSTRAINT "access_audit_logs_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "access_audit_logs"
  ADD CONSTRAINT "access_audit_logs_target_user_id_fkey"
  FOREIGN KEY ("target_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "access_audit_logs"
  ADD CONSTRAINT "access_audit_logs_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "roles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
