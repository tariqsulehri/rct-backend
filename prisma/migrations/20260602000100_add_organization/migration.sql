-- Add tenant organization ownership without cascade delete.
CREATE TABLE "organizations" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_url" TEXT,
    "base_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organizations_name_key" ON "organizations"("name");
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

INSERT INTO "organizations" ("name", "slug", "logo_url", "base_url", "updated_at")
VALUES ('tkxel', 'tkxel', '/assets/organizations/tkxel-logo.svg', 'https://tkxel.com', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
    "name" = EXCLUDED."name",
    "logo_url" = EXCLUDED."logo_url",
    "base_url" = EXCLUDED."base_url",
    "updated_at" = CURRENT_TIMESTAMP;

ALTER TABLE "departments" ADD COLUMN "organization_id" INTEGER;
ALTER TABLE "employees" ADD COLUMN "organization_id" INTEGER;

UPDATE "departments"
SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'tkxel')
WHERE "organization_id" IS NULL;

UPDATE "employees"
SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'tkxel')
WHERE "organization_id" IS NULL;

ALTER TABLE "departments" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "employees" ALTER COLUMN "organization_id" SET NOT NULL;

DROP INDEX IF EXISTS "departments_name_key";
CREATE UNIQUE INDEX "departments_organization_id_name_key" ON "departments"("organization_id", "name");
CREATE INDEX "departments_organization_id_idx" ON "departments"("organization_id");
CREATE INDEX "employees_organization_id_idx" ON "employees"("organization_id");

ALTER TABLE "departments"
ADD CONSTRAINT "departments_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employees"
ADD CONSTRAINT "employees_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
