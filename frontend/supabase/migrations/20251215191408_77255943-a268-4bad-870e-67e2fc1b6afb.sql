-- Função para obter instituicao_id do usuário atual (usando get_user_instituicao existente)
-- Já criada anteriormente

-- Criar função para verificar se usuário pertence à instituição
CREATE OR REPLACE FUNCTION public.user_belongs_to_instituicao(_user_id uuid, _instituicao_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND instituicao_id = _instituicao_id
  )
$$;

-- Atualizar políticas de profiles para filtrar por instituição (para ADMINs de instituição)
DROP POLICY IF EXISTS "Admins podem ver perfis da sua instituição" ON public.profiles;
CREATE POLICY "Admins podem ver perfis da sua instituição"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'ADMIN') 
  AND instituicao_id = get_user_instituicao(auth.uid())
);

-- Atualizar políticas de user_roles para ADMINs de instituição
DROP POLICY IF EXISTS "Admins podem ver roles da sua instituição" ON public.user_roles;
CREATE POLICY "Admins podem ver roles da sua instituição"
ON public.user_roles
FOR SELECT
USING (
  has_role(auth.uid(), 'ADMIN') 
  AND instituicao_id = get_user_instituicao(auth.uid())
);

-- Atualizar configuracoes_instituicao para permitir acesso por subdomínio
DROP POLICY IF EXISTS "Instituicoes podem ver suas configurações" ON public.instituicoes;
CREATE POLICY "Todos podem ver instituições ativas"
ON public.instituicoes
FOR SELECT
USING (status = 'ativa');

-- Políticas para cursos por instituição
ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS instituicao_id uuid REFERENCES public.instituicoes(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_cursos_instituicao_id ON public.cursos(instituicao_id);

-- Políticas para turmas por instituição
ALTER TABLE public.turmas ADD COLUMN IF NOT EXISTS instituicao_id uuid REFERENCES public.instituicoes(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_turmas_instituicao_id ON public.turmas(instituicao_id);

-- Políticas para disciplinas por instituição
ALTER TABLE public.disciplinas ADD COLUMN IF NOT EXISTS instituicao_id uuid REFERENCES public.instituicoes(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_disciplinas_instituicao_id ON public.disciplinas(instituicao_id);

-- Políticas para mensalidades por instituição
ALTER TABLE public.mensalidades ADD COLUMN IF NOT EXISTS instituicao_id uuid REFERENCES public.instituicoes(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_mensalidades_instituicao_id ON public.mensalidades(instituicao_id);

-- Políticas para comunicados por instituição
ALTER TABLE public.comunicados ADD COLUMN IF NOT EXISTS instituicao_id uuid REFERENCES public.instituicoes(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_comunicados_instituicao_id ON public.comunicados(instituicao_id);