-- Criar tabela de planos
CREATE TABLE public.planos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco_mensal NUMERIC NOT NULL DEFAULT 0,
  limite_alunos INTEGER DEFAULT NULL, -- NULL = ilimitado
  limite_professores INTEGER DEFAULT NULL,
  limite_cursos INTEGER DEFAULT NULL,
  funcionalidades JSONB DEFAULT '[]'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de assinaturas das instituições
CREATE TABLE public.assinaturas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instituicao_id UUID NOT NULL REFERENCES public.instituicoes(id) ON DELETE CASCADE,
  plano_id UUID NOT NULL REFERENCES public.planos(id),
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'suspensa', 'cancelada', 'trial')),
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE,
  data_proximo_pagamento DATE,
  valor_atual NUMERIC NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(instituicao_id)
);

-- Enable RLS
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;

-- Policies para planos
CREATE POLICY "SUPER_ADMIN pode gerenciar planos"
ON public.planos FOR ALL
USING (has_role(auth.uid(), 'SUPER_ADMIN'));

CREATE POLICY "Todos podem ver planos ativos"
ON public.planos FOR SELECT
USING (ativo = true);

-- Policies para assinaturas
CREATE POLICY "SUPER_ADMIN pode gerenciar assinaturas"
ON public.assinaturas FOR ALL
USING (has_role(auth.uid(), 'SUPER_ADMIN'));

CREATE POLICY "Admin pode ver assinatura da sua instituição"
ON public.assinaturas FOR SELECT
USING (instituicao_id = get_user_instituicao(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_planos_updated_at
BEFORE UPDATE ON public.planos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assinaturas_updated_at
BEFORE UPDATE ON public.assinaturas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir planos padrão
INSERT INTO public.planos (nome, descricao, preco_mensal, limite_alunos, limite_professores, limite_cursos, funcionalidades) VALUES
('Básico', 'Plano inicial para pequenas instituições', 50000, 100, 10, 5, '["gestao_alunos", "gestao_professores", "notas", "frequencia"]'::jsonb),
('Profissional', 'Plano intermediário com mais recursos', 150000, 500, 50, 20, '["gestao_alunos", "gestao_professores", "notas", "frequencia", "financeiro", "documentos", "comunicados"]'::jsonb),
('Enterprise', 'Plano completo sem limites', 300000, NULL, NULL, NULL, '["gestao_alunos", "gestao_professores", "notas", "frequencia", "financeiro", "documentos", "comunicados", "alojamentos", "analytics", "api_access"]'::jsonb);

-- Função para verificar limite de alunos
CREATE OR REPLACE FUNCTION public.verificar_limite_alunos(_instituicao_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.limite_alunos IS NULL OR 
            (SELECT COUNT(*) FROM profiles pr 
             JOIN user_roles ur ON ur.user_id = pr.id 
             WHERE pr.instituicao_id = _instituicao_id AND ur.role = 'ALUNO') < p.limite_alunos
     FROM assinaturas a
     JOIN planos p ON p.id = a.plano_id
     WHERE a.instituicao_id = _instituicao_id AND a.status = 'ativa'),
    true
  )
$$;