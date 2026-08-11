-- CreateTable: behav_level
CREATE TABLE "behav_level" (
    "code" TEXT NOT NULL,
    "ordinal" SMALLINT NOT NULL,
    "centi_weight" SMALLINT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "behav_level_pkey" PRIMARY KEY ("code")
);

-- CreateTable: behav_competency
CREATE TABLE "behav_competency" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sort" SMALLINT NOT NULL,

    CONSTRAINT "behav_competency_pkey" PRIMARY KEY ("key"),
    CONSTRAINT "behav_competency_type_check" CHECK ("type" IN ('core', 'leadership'))
);

-- CreateTable: behav_grade
CREATE TABLE "behav_grade" (
    "key" TEXT NOT NULL,
    "ordinal" SMALLINT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "behav_grade_pkey" PRIMARY KEY ("key")
);

-- CreateTable: behav_expected
CREATE TABLE "behav_expected" (
    "grade_key" TEXT NOT NULL,
    "competency_key" TEXT NOT NULL,
    "level" TEXT NOT NULL,

    CONSTRAINT "behav_expected_pkey" PRIMARY KEY ("grade_key", "competency_key")
);

-- CreateTable: behav_assessment
CREATE TABLE "behav_assessment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subject_id" TEXT NOT NULL,
    "grade_key" TEXT NOT NULL,
    "assessed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assessor_id" TEXT,

    CONSTRAINT "behav_assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: behav_rating
CREATE TABLE "behav_rating" (
    "assessment_id" UUID NOT NULL,
    "competency_key" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "evidence" TEXT,

    CONSTRAINT "behav_rating_pkey" PRIMARY KEY ("assessment_id", "competency_key")
);

-- CreateIndexes
CREATE INDEX "behav_expected_grade_key_idx" ON "behav_expected"("grade_key");
CREATE INDEX "behav_expected_competency_key_idx" ON "behav_expected"("competency_key");
CREATE INDEX "behav_expected_level_idx" ON "behav_expected"("level");

CREATE INDEX "behav_assessment_subject_id_idx" ON "behav_assessment"("subject_id");
CREATE INDEX "behav_assessment_grade_key_idx" ON "behav_assessment"("grade_key");
CREATE INDEX "behav_assessment_assessed_at_idx" ON "behav_assessment"("assessed_at");

CREATE INDEX "behav_rating_assessment_id_idx" ON "behav_rating"("assessment_id");
CREATE INDEX "behav_rating_competency_key_idx" ON "behav_rating"("competency_key");
CREATE INDEX "behav_rating_level_idx" ON "behav_rating"("level");

-- AddForeignKeys
ALTER TABLE "behav_expected" ADD CONSTRAINT "behav_expected_grade_key_fkey" FOREIGN KEY ("grade_key") REFERENCES "behav_grade"("key") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "behav_expected" ADD CONSTRAINT "behav_expected_competency_key_fkey" FOREIGN KEY ("competency_key") REFERENCES "behav_competency"("key") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "behav_expected" ADD CONSTRAINT "behav_expected_level_fkey" FOREIGN KEY ("level") REFERENCES "behav_level"("code") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "behav_assessment" ADD CONSTRAINT "behav_assessment_grade_key_fkey" FOREIGN KEY ("grade_key") REFERENCES "behav_grade"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "behav_rating" ADD CONSTRAINT "behav_rating_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "behav_assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "behav_rating" ADD CONSTRAINT "behav_rating_competency_key_fkey" FOREIGN KEY ("competency_key") REFERENCES "behav_competency"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "behav_rating" ADD CONSTRAINT "behav_rating_level_fkey" FOREIGN KEY ("level") REFERENCES "behav_level"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
