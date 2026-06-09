ALTER TABLE public.competency_scores
    ADD COLUMN IF NOT EXISTS department_id INTEGER;

UPDATE public.competency_scores cs
SET department_id = e.department_id
FROM public.employees e
WHERE e.id = cs.employee_id
  AND cs.department_id IS DISTINCT FROM e.department_id;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'competency_scores_department_id_fkey'
          AND conrelid = 'public.competency_scores'::regclass
    ) THEN
        ALTER TABLE public.competency_scores
            ADD CONSTRAINT competency_scores_department_id_fkey
            FOREIGN KEY (department_id)
            REFERENCES public.departments(id)
            ON DELETE SET NULL
            ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS competency_scores_department_id_idx
    ON public.competency_scores(department_id);
