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

CREATE UNIQUE INDEX "assessment_level_configs_code_key" ON "assessment_level_configs"("code");
CREATE UNIQUE INDEX "assessment_status_configs_code_key" ON "assessment_status_configs"("code");
CREATE UNIQUE INDEX "assessment_project_configs_project_count_key" ON "assessment_project_configs"("project_count");

INSERT INTO "assessment_level_configs" ("code", "label", "weight", "threshold", "description", "sort_order", "is_active", "updated_at")
VALUES
  ('Expert', 'Expert', 1.00, 0.80, 'Deep independent ownership and expert-level execution.', 1, true, NOW()),
  ('Advanced', 'Advanced', 0.80, 0.60, 'Strong practical skill with limited guidance needed.', 2, true, NOW()),
  ('Proficient', 'Proficient', 0.60, 0.40, 'Working proficiency for delivery tasks.', 3, true, NOW()),
  ('Foundational', 'Foundational', 0.40, 0.20, 'Basic working understanding with support needed.', 4, true, NOW()),
  ('Beginner', 'Beginner', 0.40, 0.20, 'Early-stage skill exposure.', 5, true, NOW()),
  ('Awareness', 'Awareness', 0.20, 0.01, 'Conceptual awareness or light exposure.', 6, true, NOW()),
  ('Unset', 'Unset', 0.00, 0.00, 'No level selected yet.', 7, true, NOW())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "assessment_status_configs" ("code", "label", "description", "counts_toward_score", "is_terminal", "sort_order", "is_active", "updated_at")
VALUES
  ('approved', 'Approved', 'Manager-approved assessment. Counts toward competency and report scores.', true, true, 1, true, NOW()),
  ('pending', 'Pending', 'Submitted assessment waiting for manager approval. Does not count toward scores.', false, false, 2, true, NOW()),
  ('rejected', 'Rejected', 'Assessment rejected during review. Does not count toward scores.', false, true, 3, true, NOW()),
  ('draft', 'Draft', 'Unsubmitted or in-progress assessment. Does not count toward scores.', false, false, 4, true, NOW())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "assessment_project_configs" ("project_count", "label", "description", "duration_months_min", "duration_months_max", "credit", "threshold", "sort_order", "is_active", "updated_at")
VALUES
  (0, '0 projects', 'No project delivery experience yet.', 0, 0, 0.000000, 0.00, 1, true, NOW()),
  (1, '1 project', 'Used in at least one real project.', 1, 3, 0.333333, 0.25, 2, true, NOW()),
  (2, '2 projects', 'Used across two real projects.', 3, 6, 0.666667, 0.50, 3, true, NOW()),
  (3, '3+ projects', 'Used in three or more real projects. This is the scoring cap.', 6, NULL, 1.000000, 0.75, 4, true, NOW())
ON CONFLICT ("project_count") DO NOTHING;
