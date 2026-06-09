ALTER TABLE public.skill_assessments
ADD COLUMN IF NOT EXISTS domain_id INTEGER,
ADD COLUMN IF NOT EXISTS competency_id INTEGER;

WITH competency_domains AS (
  SELECT DISTINCT ON (competency_id)
    competency_id,
    domain_id
  FROM public.competency_domain_maps
  ORDER BY competency_id, is_primary DESC, id ASC
)
UPDATE public.skill_assessments AS sa
SET
  competency_id = t.competency_id,
  domain_id = cd.domain_id
FROM public.technologies AS t
LEFT JOIN competency_domains AS cd
  ON cd.competency_id = t.competency_id
WHERE t.id = sa.technology_id
  AND (
    sa.competency_id IS DISTINCT FROM t.competency_id
    OR sa.domain_id IS DISTINCT FROM cd.domain_id
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'skill_assessments_domain_id_fkey'
      AND conrelid = 'public.skill_assessments'::regclass
  ) THEN
    ALTER TABLE public.skill_assessments
    ADD CONSTRAINT skill_assessments_domain_id_fkey
    FOREIGN KEY (domain_id)
    REFERENCES public.skill_domains(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'skill_assessments_competency_id_fkey'
      AND conrelid = 'public.skill_assessments'::regclass
  ) THEN
    ALTER TABLE public.skill_assessments
    ADD CONSTRAINT skill_assessments_competency_id_fkey
    FOREIGN KEY (competency_id)
    REFERENCES public.competencies(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS skill_assessments_domain_id_idx
ON public.skill_assessments(domain_id);

CREATE INDEX IF NOT EXISTS skill_assessments_competency_id_idx
ON public.skill_assessments(competency_id);
