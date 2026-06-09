-- Rename the competency threshold matrix to match its domain meaning.
-- Keep a read-compatible grade_matrix view for legacy scripts and queries.

DO $$
DECLARE
    grade_matrix_kind "char";
    thresholds_exists boolean;
BEGIN
    SELECT c.relkind
      INTO grade_matrix_kind
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = 'grade_matrix';

    SELECT to_regclass('public.competency_grade_thresholds') IS NOT NULL
      INTO thresholds_exists;

    IF grade_matrix_kind = 'v' THEN
        EXECUTE 'DROP VIEW public.grade_matrix';
        grade_matrix_kind := NULL;
    END IF;

    IF NOT thresholds_exists THEN
        IF grade_matrix_kind = 'r' THEN
            ALTER TABLE public.grade_matrix RENAME TO competency_grade_thresholds;

            IF EXISTS (
                SELECT 1 FROM pg_constraint
                 WHERE conname = 'grade_matrix_pkey'
                   AND conrelid = 'public.competency_grade_thresholds'::regclass
            ) THEN
                ALTER TABLE public.competency_grade_thresholds
                    RENAME CONSTRAINT grade_matrix_pkey TO competency_grade_thresholds_pkey;
            END IF;

            IF EXISTS (
                SELECT 1 FROM pg_constraint
                 WHERE conname = 'grade_matrix_grade_id_fkey'
                   AND conrelid = 'public.competency_grade_thresholds'::regclass
            ) THEN
                ALTER TABLE public.competency_grade_thresholds
                    RENAME CONSTRAINT grade_matrix_grade_id_fkey TO competency_grade_thresholds_grade_id_fkey;
            END IF;

            IF EXISTS (
                SELECT 1 FROM pg_constraint
                 WHERE conname = 'grade_matrix_competency_id_fkey'
                   AND conrelid = 'public.competency_grade_thresholds'::regclass
            ) THEN
                ALTER TABLE public.competency_grade_thresholds
                    RENAME CONSTRAINT grade_matrix_competency_id_fkey TO competency_grade_thresholds_competency_id_fkey;
            END IF;

            IF to_regclass('public.grade_matrix_id_seq') IS NOT NULL
               AND to_regclass('public.competency_grade_thresholds_id_seq') IS NULL THEN
                ALTER SEQUENCE public.grade_matrix_id_seq
                    RENAME TO competency_grade_thresholds_id_seq;
            END IF;
        ELSE
            CREATE TABLE public.competency_grade_thresholds (
                id SERIAL NOT NULL,
                grade_id INTEGER NOT NULL,
                competency_id INTEGER NOT NULL,
                threshold DOUBLE PRECISION NOT NULL,
                CONSTRAINT competency_grade_thresholds_pkey PRIMARY KEY (id),
                CONSTRAINT competency_grade_thresholds_grade_id_fkey
                    FOREIGN KEY (grade_id) REFERENCES public.grades(id) ON DELETE CASCADE ON UPDATE CASCADE,
                CONSTRAINT competency_grade_thresholds_competency_id_fkey
                    FOREIGN KEY (competency_id) REFERENCES public.competencies(id) ON DELETE CASCADE ON UPDATE CASCADE
            );
        END IF;
    END IF;
END $$;

ALTER TABLE public.competency_grade_thresholds
    ALTER COLUMN id SET DEFAULT nextval('public.competency_grade_thresholds_id_seq'::regclass);

ALTER SEQUENCE public.competency_grade_thresholds_id_seq
    OWNED BY public.competency_grade_thresholds.id;

ALTER INDEX IF EXISTS public.grade_matrix_grade_id_idx
    RENAME TO competency_grade_thresholds_grade_id_idx;

ALTER INDEX IF EXISTS public.grade_matrix_competency_id_idx
    RENAME TO competency_grade_thresholds_competency_id_idx;

ALTER INDEX IF EXISTS public.grade_matrix_grade_id_competency_id_key
    RENAME TO competency_grade_thresholds_grade_id_competency_id_key;

CREATE INDEX IF NOT EXISTS competency_grade_thresholds_grade_id_idx
    ON public.competency_grade_thresholds(grade_id);

CREATE INDEX IF NOT EXISTS competency_grade_thresholds_competency_id_idx
    ON public.competency_grade_thresholds(competency_id);

CREATE UNIQUE INDEX IF NOT EXISTS competency_grade_thresholds_grade_id_competency_id_key
    ON public.competency_grade_thresholds(grade_id, competency_id);

CREATE OR REPLACE VIEW public.grade_matrix AS
SELECT id, grade_id, competency_id, threshold
FROM public.competency_grade_thresholds;
