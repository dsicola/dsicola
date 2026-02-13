-- Create backup_schedules table
CREATE TABLE public.backup_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instituicao_id UUID REFERENCES public.instituicoes(id) ON DELETE CASCADE,
  frequencia TEXT NOT NULL DEFAULT 'semanal', -- 'diario', 'semanal', 'mensal'
  tipo_backup TEXT NOT NULL DEFAULT 'completo', -- 'dados', 'arquivos', 'completo'
  hora_execucao TIME NOT NULL DEFAULT '03:00:00',
  dia_semana INTEGER, -- 0-6 (domingo-sábado) para semanal
  dia_mes INTEGER, -- 1-31 para mensal
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultimo_backup TIMESTAMP WITH TIME ZONE,
  proximo_backup TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.backup_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "SUPER_ADMIN pode gerenciar todos agendamentos"
ON public.backup_schedules
FOR ALL
USING (has_role(auth.uid(), 'SUPER_ADMIN'));

CREATE POLICY "ADMIN pode gerenciar agendamentos da sua instituição"
ON public.backup_schedules
FOR ALL
USING (
  has_role(auth.uid(), 'ADMIN') AND 
  instituicao_id = get_user_instituicao(auth.uid())
);

-- Index
CREATE INDEX idx_backup_schedules_instituicao ON public.backup_schedules(instituicao_id);
CREATE INDEX idx_backup_schedules_proximo ON public.backup_schedules(proximo_backup) WHERE ativo = true;

-- Trigger for updated_at
CREATE TRIGGER update_backup_schedules_updated_at
BEFORE UPDATE ON public.backup_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable pg_cron and pg_net extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;