-- Remove the old check constraint that limits to 0-10
ALTER TABLE public.notas DROP CONSTRAINT IF EXISTS notas_valor_check;

-- Add new check constraint for 0-20 range (university scale)
ALTER TABLE public.notas ADD CONSTRAINT notas_valor_check CHECK (valor >= 0 AND valor <= 20);