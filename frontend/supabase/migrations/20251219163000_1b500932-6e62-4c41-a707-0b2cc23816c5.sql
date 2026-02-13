-- Fix duplicate key on turnos: make uniqueness tenant-aware
ALTER TABLE public.turnos DROP CONSTRAINT IF EXISTS turnos_nome_key;

-- Unique per institution (allows same 'Manhã/Tarde/Noite' across institutions)
CREATE UNIQUE INDEX IF NOT EXISTS turnos_instituicao_nome_key
  ON public.turnos (instituicao_id, nome);

-- Keep global (instituicao_id IS NULL) turnos unique by name
CREATE UNIQUE INDEX IF NOT EXISTS turnos_nome_global_key
  ON public.turnos (nome)
  WHERE instituicao_id IS NULL;