-- CreateTable
CREATE TABLE "comm_assessments" (
    "id" UUID NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "org_level_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "assessor_id" INTEGER,
    "assessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comm_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comm_ratings" (
    "assessment_id" UUID NOT NULL,
    "competency_key" TEXT NOT NULL,
    "cefr" TEXT NOT NULL,
    "evidence" TEXT,

    CONSTRAINT "comm_ratings_pkey" PRIMARY KEY ("assessment_id","competency_key")
);

-- CreateIndex
CREATE INDEX "comm_assessments_subject_id_idx" ON "comm_assessments"("subject_id");

-- CreateIndex
CREATE INDEX "comm_assessments_assessor_id_idx" ON "comm_assessments"("assessor_id");

-- CreateIndex
CREATE INDEX "comm_assessments_status_idx" ON "comm_assessments"("status");

-- CreateIndex
CREATE INDEX "comm_assessments_assessed_at_idx" ON "comm_assessments"("assessed_at");

-- CreateIndex
CREATE INDEX "comm_ratings_assessment_id_idx" ON "comm_ratings"("assessment_id");

-- CreateIndex
CREATE INDEX "comm_ratings_competency_key_idx" ON "comm_ratings"("competency_key");

-- AddForeignKey
ALTER TABLE "comm_assessments" ADD CONSTRAINT "comm_assessments_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_assessments" ADD CONSTRAINT "comm_assessments_assessor_id_fkey" FOREIGN KEY ("assessor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_ratings" ADD CONSTRAINT "comm_ratings_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "comm_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
