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

CREATE TABLE "assessment_level_configs" (
  "id" SERIAL NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "threshold" DOUBLE PRECISION,
  "description" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "assessment_level_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assessment_status_configs" (
  "id" SERIAL NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "counts_toward_score" BOOLEAN NOT NULL DEFAULT false,
  "is_terminal" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "assessment_status_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assessment_project_configs" (
  "id" SERIAL NOT NULL,
  "project_count" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "duration_months_min" INTEGER,
  "duration_months_max" INTEGER,
  "credit" DOUBLE PRECISION NOT NULL,
  "threshold" DOUBLE PRECISION,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "assessment_project_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assessment_type_configs_code_key" ON "assessment_type_configs"("code");
CREATE UNIQUE INDEX "assessment_level_configs_code_key" ON "assessment_level_configs"("code");
CREATE UNIQUE INDEX "assessment_status_configs_code_key" ON "assessment_status_configs"("code");
CREATE UNIQUE INDEX "assessment_project_configs_project_count_key" ON "assessment_project_configs"("project_count");
