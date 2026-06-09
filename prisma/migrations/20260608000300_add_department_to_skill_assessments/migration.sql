ALTER TABLE public.skill_assessments
ADD COLUMN IF NOT EXISTS department_id INTEGER;

UPDATE public.skill_assessments AS sa
SET department_id = e.department_id
FROM public.employees AS e
WHERE e.id = sa.employee_id
  AND sa.department_id IS DISTINCT FROM e.department_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'skill_assessments_department_id_fkey'
      AND conrelid = 'public.skill_assessments'::regclass
  ) THEN
    ALTER TABLE public.skill_assessments
    ADD CONSTRAINT skill_assessments_department_id_fkey
    FOREIGN KEY (department_id)
    REFERENCES public.departments(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS skill_assessments_department_id_idx
ON public.skill_assessments(department_id);
