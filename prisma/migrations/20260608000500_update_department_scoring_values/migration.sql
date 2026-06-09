ALTER TABLE public.department_configs
  ALTER COLUMN primary_weight SET DEFAULT 0.25,
  ALTER COLUMN secondary_weight SET DEFAULT 0.15,
  ALTER COLUMN tertiary_weight SET DEFAULT 0.10;

UPDATE public.department_configs
SET
  primary_weight = 0.25,
  secondary_weight = 0.15,
  tertiary_weight = 0.10
WHERE primary_weight = 0.5
  AND secondary_weight = 0.3
  AND tertiary_weight = 0.2;
