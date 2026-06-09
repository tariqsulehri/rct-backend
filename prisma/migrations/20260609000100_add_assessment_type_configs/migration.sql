CREATE TABLE "assessment_type_configs" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_type_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assessment_type_configs_code_key" ON "assessment_type_configs"("code");

INSERT INTO "assessment_type_configs" ("code", "label", "weight", "description", "sort_order", "is_active", "updated_at")
VALUES
  ('Primary', 'Primary', 0.25, 'Main technology for the competency. Gives highest credit.', 1, true, NOW()),
  ('Secondary', 'Secondary', 0.15, 'Supporting technology. Gives medium credit.', 2, true, NOW()),
  ('Tertiary', 'Tertiary', 0.10, 'Related technology. Gives lower credit.', 3, true, NOW())
ON CONFLICT ("code") DO NOTHING;
