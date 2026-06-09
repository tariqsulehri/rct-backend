INSERT INTO "assessment_type_configs" ("code", "label", "weight", "description", "sort_order", "is_active", "updated_at")
VALUES
  ('Primary', 'Primary', 0.25, 'Base score is the starting score. Example: Primary 0.25 gives more score than Secondary 0.15.', 1, true, CURRENT_TIMESTAMP),
  ('Secondary', 'Secondary', 0.15, 'Base score is the starting score. Example: Secondary 0.15 gives medium score.', 2, true, CURRENT_TIMESTAMP),
  ('Tertiary', 'Tertiary', 0.10, 'Base score is the starting score. Example: Tertiary 0.10 gives lower score.', 3, true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "label" = EXCLUDED."label",
  "description" = EXCLUDED."description",
  "sort_order" = EXCLUDED."sort_order",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "assessment_level_configs" ("code", "label", "weight", "threshold", "description", "sort_order", "is_active", "updated_at")
VALUES
  ('Expert', 'Expert', 1.00, 0.80, 'Base score multiplies skill score; minimum target shows the expected skill level. Example: 1.00 Base score, 0.80 target.', 1, true, CURRENT_TIMESTAMP),
  ('Advanced', 'Advanced', 0.80, 0.60, 'Base score multiplies skill score; minimum target shows the expected skill level. Example: 0.80 Base score, 0.60 target.', 2, true, CURRENT_TIMESTAMP),
  ('Proficient', 'Proficient', 0.60, 0.40, 'Base score multiplies skill score; minimum target shows the expected skill level. Example: 0.60 Base score, 0.40 target.', 3, true, CURRENT_TIMESTAMP),
  ('Foundational', 'Foundational', 0.40, 0.20, 'Base score multiplies skill score; minimum target shows the expected skill level. Example: 0.40 Base score, 0.20 target.', 4, true, CURRENT_TIMESTAMP),
  ('Beginner', 'Beginner', 0.40, 0.20, 'Base score multiplies skill score; minimum target shows the expected skill level. Example: 0.40 Base score, 0.20 target.', 5, true, CURRENT_TIMESTAMP),
  ('Awareness', 'Awareness', 0.20, 0.01, 'Base score gives light score; minimum target marks basic recognition. Example: 0.20 Base score, 0.01 target.', 6, true, CURRENT_TIMESTAMP),
  ('Unset', 'Unset', 0.00, 0.00, 'No selected level. Base score 0.00 means it adds no score; minimum target 0.00 means no target.', 7, true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "label" = EXCLUDED."label",
  "description" = EXCLUDED."description",
  "sort_order" = EXCLUDED."sort_order",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "assessment_status_configs" ("code", "label", "description", "counts_toward_score", "is_terminal", "sort_order", "is_active", "updated_at")
VALUES
  ('approved', 'Approved', 'Affects score is Yes, so this assessment affects calculations. Review complete means no more action is needed.', true, true, 1, true, CURRENT_TIMESTAMP),
  ('pending', 'Pending', 'Affects score is No until approved. Review complete is No because manager review is still open.', false, false, 2, true, CURRENT_TIMESTAMP),
  ('rejected', 'Rejected', 'Affects score is No. Review complete means the review is closed and will not affect score.', false, true, 3, true, CURRENT_TIMESTAMP),
  ('draft', 'Draft', 'Affects score is No. Review complete is No because the assessment is still being prepared.', false, false, 4, true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "label" = EXCLUDED."label",
  "description" = EXCLUDED."description",
  "sort_order" = EXCLUDED."sort_order",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "assessment_project_configs" ("project_count", "label", "description", "duration_months_min", "duration_months_max", "credit", "threshold", "sort_order", "is_active", "updated_at")
VALUES
  (0, '0 projects', 'Project score adds delivery experience to the score; minimum target is the expected project exposure. Example: 0 projects gives 0 project score, 0 target.', 0, 0, 0, 0, 1, true, CURRENT_TIMESTAMP),
  (1, '1 project', 'Project score adds delivery experience to the score; minimum target is the expected project exposure. Example: 1 project gives 0.33 project score, 0.25 target.', 1, 3, 0.3333333333333333, 0.25, 2, true, CURRENT_TIMESTAMP),
  (2, '2 projects', 'Project score adds delivery experience to the score; minimum target is the expected project exposure. Example: 2 projects gives 0.67 project score, 0.50 target.', 3, 6, 0.6666666666666666, 0.50, 3, true, CURRENT_TIMESTAMP),
  (3, '3+ projects', 'Project score adds delivery experience to the score; minimum target is the expected project exposure. Example: 3+ projects gives 1.00 project score, 0.75 target.', 6, NULL, 1, 0.75, 4, true, CURRENT_TIMESTAMP)
ON CONFLICT ("project_count") DO UPDATE SET
  "label" = EXCLUDED."label",
  "description" = EXCLUDED."description",
  "sort_order" = EXCLUDED."sort_order",
  "updated_at" = CURRENT_TIMESTAMP;
