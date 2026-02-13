-- Adicionar role RESPONSAVEL ao enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'RESPONSAVEL';

-- Criar tabela de relacionamento entre responsáveis e alunos
CREATE TABLE public.responsavel_alunos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  responsavel_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parentesco TEXT NOT NULL DEFAULT 'Pai/Mãe',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(responsavel_id, aluno_id)
);

-- Criar tabela de mensagens entre responsáveis e professores
CREATE TABLE public.mensagens_responsavel (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  responsavel_id UUID NOT NULL,
  professor_id UUID NOT NULL,
  aluno_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assunto TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  lida BOOLEAN NOT NULL DEFAULT false,
  respondida BOOLEAN NOT NULL DEFAULT false,
  resposta TEXT,
  data_resposta TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.responsavel_alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens_responsavel ENABLE ROW LEVEL SECURITY;

-- Políticas para responsavel_alunos
CREATE POLICY "Admins podem gerenciar relacionamentos"
ON public.responsavel_alunos
FOR ALL
USING (has_role(auth.uid(), 'ADMIN'::user_role));

CREATE POLICY "Secretaria pode gerenciar relacionamentos"
ON public.responsavel_alunos
FOR ALL
USING (has_role(auth.uid(), 'SECRETARIA'::user_role));

CREATE POLICY "Responsáveis podem ver seus alunos"
ON public.responsavel_alunos
FOR SELECT
USING (responsavel_id = auth.uid());

-- Políticas para mensagens_responsavel
CREATE POLICY "Admins podem ver todas mensagens"
ON public.mensagens_responsavel
FOR ALL
USING (has_role(auth.uid(), 'ADMIN'::user_role));

CREATE POLICY "Responsáveis podem gerenciar suas mensagens"
ON public.mensagens_responsavel
FOR ALL
USING (responsavel_id = auth.uid());

CREATE POLICY "Professores podem ver e responder mensagens"
ON public.mensagens_responsavel
FOR ALL
USING (professor_id = auth.uid());

-- Trigger para updated_at
CREATE TRIGGER update_mensagens_responsavel_updated_at
BEFORE UPDATE ON public.mensagens_responsavel
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Política para responsáveis verem perfis dos alunos
CREATE POLICY "Responsáveis podem ver perfis de seus alunos"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.responsavel_alunos
    WHERE responsavel_alunos.responsavel_id = auth.uid()
    AND responsavel_alunos.aluno_id = profiles.id
  )
);

-- Política para responsáveis verem matrículas dos alunos
CREATE POLICY "Responsáveis podem ver matrículas de seus alunos"
ON public.matriculas
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.responsavel_alunos
    WHERE responsavel_alunos.responsavel_id = auth.uid()
    AND responsavel_alunos.aluno_id = matriculas.aluno_id
  )
);

-- Política para responsáveis verem notas dos alunos
CREATE POLICY "Responsáveis podem ver notas de seus alunos"
ON public.notas
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.matriculas m
    JOIN public.responsavel_alunos ra ON ra.aluno_id = m.aluno_id
    WHERE m.id = notas.matricula_id
    AND ra.responsavel_id = auth.uid()
  )
);

-- Política para responsáveis verem frequências dos alunos
CREATE POLICY "Responsáveis podem ver frequências de seus alunos"
ON public.frequencias
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.responsavel_alunos
    WHERE responsavel_alunos.responsavel_id = auth.uid()
    AND responsavel_alunos.aluno_id = frequencias.aluno_id
  )
);

-- Política para responsáveis verem turmas dos alunos
CREATE POLICY "Responsáveis podem ver turmas de seus alunos"
ON public.turmas
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.matriculas m
    JOIN public.responsavel_alunos ra ON ra.aluno_id = m.aluno_id
    WHERE m.turma_id = turmas.id
    AND ra.responsavel_id = auth.uid()
  )
);