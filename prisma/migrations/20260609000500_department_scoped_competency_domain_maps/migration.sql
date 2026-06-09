-- Make skill-area mappings department-specific.
-- Existing mappings belong to the current DevOps dataset.

INSERT INTO "organizations" ("name", "slug", "logo_url", "base_url", "created_at", "updated_at")
VALUES ('tkxel', 'tkxel', '/assets/organizations/tkxel-logo.svg', 'https://tkxel.com', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE
SET "name" = EXCLUDED."name",
    "logo_url" = EXCLUDED."logo_url",
    "base_url" = EXCLUDED."base_url",
    "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "departments" ("organization_id", "name", "description", "created_at")
SELECT "id", 'DevOps', 'Default department for the current DevOps scoring data.', CURRENT_TIMESTAMP
FROM "organizations"
WHERE "slug" = 'tkxel'
ON CONFLICT ("organization_id", "name") DO UPDATE
SET "description" = COALESCE("departments"."description", EXCLUDED."description");

ALTER TABLE "competency_domain_maps" ADD COLUMN "department_id" INTEGER;

UPDATE "competency_domain_maps"
SET "department_id" = (
  SELECT d."id"
  FROM "departments" d
  JOIN "organizations" o ON o."id" = d."organization_id"
  WHERE o."slug" = 'tkxel' AND d."name" = 'DevOps'
  LIMIT 1
)
WHERE "department_id" IS NULL;

ALTER TABLE "competency_domain_maps" ALTER COLUMN "department_id" SET NOT NULL;

DROP INDEX IF EXISTS "competency_domain_maps_competency_id_domain_id_key";
CREATE INDEX "competency_domain_maps_department_id_idx" ON "competency_domain_maps"("department_id");
CREATE UNIQUE INDEX "competency_domain_maps_department_id_competency_id_domain_id_key"
ON "competency_domain_maps"("department_id", "competency_id", "domain_id");

ALTER TABLE "competency_domain_maps"
ADD CONSTRAINT "competency_domain_maps_department_id_fkey"
FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
