-- Tabela para logs de exportação SAFT
CREATE TABLE public.saft_exports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instituicao_id UUID NOT NULL REFERENCES public.instituicoes(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES public.profiles(id),
  usuario_nome TEXT NOT NULL,
  usuario_email TEXT NOT NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  arquivo_nome TEXT NOT NULL,
  total_clientes INTEGER NOT NULL DEFAULT 0,
  total_produtos INTEGER NOT NULL DEFAULT 0,
  total_faturas INTEGER NOT NULL DEFAULT 0,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'gerado',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saft_exports ENABLE ROW LEVEL SECURITY;

-- Policy: ADMIN pode ver/inserir exports da sua instituição
CREATE POLICY "Admin pode gerenciar exports da sua instituição"
ON public.saft_exports
FOR ALL
USING (
  has_role(auth.uid(), 'ADMIN'::user_role) AND 
  instituicao_id = get_user_instituicao(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'ADMIN'::user_role) AND 
  instituicao_id = get_user_instituicao(auth.uid())
);

-- Policy: SUPER_ADMIN pode ver/gerenciar todos exports
CREATE POLICY "Super Admin pode gerenciar todos exports"
ON public.saft_exports
FOR ALL
USING (has_role(auth.uid(), 'SUPER_ADMIN'::user_role))
WITH CHECK (has_role(auth.uid(), 'SUPER_ADMIN'::user_role));

-- Index para busca por instituição e período
CREATE INDEX idx_saft_exports_instituicao ON public.saft_exports(instituicao_id);
CREATE INDEX idx_saft_exports_periodo ON public.saft_exports(periodo_inicio, periodo_fim);