-- Tabela para controlar o fechamento de trimestres (apenas Ensino Médio)
CREATE TABLE public.trimestres_fechados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id UUID NOT NULL REFERENCES public.instituicoes(id) ON DELETE CASCADE,
  ano_letivo INTEGER NOT NULL,
  trimestre INTEGER NOT NULL CHECK (trimestre BETWEEN 1 AND 3),
  fechado BOOLEAN NOT NULL DEFAULT false,
  data_fechamento TIMESTAMP WITH TIME ZONE,
  fechado_por UUID REFERENCES public.profiles(id),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(instituicao_id, ano_letivo, trimestre)
);

-- Tabela para histórico de alterações de notas
CREATE TABLE public.notas_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_id UUID NOT NULL REFERENCES public.notas(id) ON DELETE CASCADE,
  matricula_id UUID NOT NULL,
  alterado_por UUID NOT NULL REFERENCES public.profiles(id),
  alterado_por_nome TEXT NOT NULL,
  alterado_por_email TEXT NOT NULL,
  nota_anterior NUMERIC NOT NULL,
  nota_nova NUMERIC NOT NULL,
  tipo_nota TEXT NOT NULL,
  motivo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trimestres_fechados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_historico ENABLE ROW LEVEL SECURITY;

-- Policies para trimestres_fechados
CREATE POLICY "Admin pode gerenciar fechamento de trimestres"
ON public.trimestres_fechados
FOR ALL
USING (
  has_role(auth.uid(), 'ADMIN'::user_role) 
  AND instituicao_id = get_user_instituicao(auth.uid())
);

CREATE POLICY "Professores podem ver status de fechamento"
ON public.trimestres_fechados
FOR SELECT
USING (
  has_role(auth.uid(), 'PROFESSOR'::user_role) 
  AND instituicao_id = get_user_instituicao(auth.uid())
);

CREATE POLICY "SUPER_ADMIN pode gerenciar todos fechamentos"
ON public.trimestres_fechados
FOR ALL
USING (has_role(auth.uid(), 'SUPER_ADMIN'::user_role));

-- Policies para notas_historico
CREATE POLICY "Admin e SUPER_ADMIN podem ver histórico de notas"
ON public.notas_historico
FOR SELECT
USING (
  has_role(auth.uid(), 'ADMIN'::user_role) 
  OR has_role(auth.uid(), 'SUPER_ADMIN'::user_role)
);

CREATE POLICY "Sistema pode inserir histórico de notas"
ON public.notas_historico
FOR INSERT
WITH CHECK (true);

-- Função para verificar se trimestre está fechado
CREATE OR REPLACE FUNCTION public.trimestre_fechado(
  _instituicao_id UUID,
  _ano_letivo INTEGER,
  _trimestre INTEGER
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT fechado FROM public.trimestres_fechados 
     WHERE instituicao_id = _instituicao_id 
     AND ano_letivo = _ano_letivo 
     AND trimestre = _trimestre),
    false
  )
$$;

-- Função para verificar se professor pode editar nota da turma
CREATE OR REPLACE FUNCTION public.professor_pode_editar_nota(
  _professor_id UUID,
  _turma_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.turmas
    WHERE id = _turma_id AND professor_id = _professor_id
  )
$$;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_trimestres_fechados_updated_at
BEFORE UPDATE ON public.trimestres_fechados
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_trimestres_fechados_instituicao ON public.trimestres_fechados(instituicao_id);
CREATE INDEX idx_notas_historico_nota ON public.notas_historico(nota_id);
CREATE INDEX idx_notas_historico_created ON public.notas_historico(created_at DESC);