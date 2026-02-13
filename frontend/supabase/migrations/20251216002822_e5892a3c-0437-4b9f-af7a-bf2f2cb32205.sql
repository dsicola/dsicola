-- Create backup_history table
CREATE TABLE public.backup_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  tipo TEXT NOT NULL DEFAULT 'completo', -- 'dados', 'arquivos', 'completo'
  status TEXT NOT NULL DEFAULT 'em_progresso', -- 'em_progresso', 'concluido', 'erro'
  tamanho_bytes BIGINT,
  arquivo_url TEXT,
  erro TEXT,
  instituicao_id UUID REFERENCES public.instituicoes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.backup_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "SUPER_ADMIN pode gerenciar todos backups"
ON public.backup_history
FOR ALL
USING (has_role(auth.uid(), 'SUPER_ADMIN'));

CREATE POLICY "ADMIN pode ver backups da sua instituição"
ON public.backup_history
FOR SELECT
USING (
  has_role(auth.uid(), 'ADMIN') AND 
  instituicao_id = get_user_instituicao(auth.uid())
);

CREATE POLICY "ADMIN pode inserir backups da sua instituição"
ON public.backup_history
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'ADMIN') AND 
  instituicao_id = get_user_instituicao(auth.uid())
);

-- Index for faster queries
CREATE INDEX idx_backup_history_instituicao ON public.backup_history(instituicao_id);
CREATE INDEX idx_backup_history_created ON public.backup_history(created_at DESC);