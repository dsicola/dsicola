-- Adicionar instituicao_id à tabela turnos para isolamento multi-tenant
ALTER TABLE public.turnos ADD COLUMN IF NOT EXISTS instituicao_id uuid REFERENCES public.instituicoes(id);

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_turnos_instituicao ON public.turnos(instituicao_id);

-- Atualizar políticas RLS para turnos
DROP POLICY IF EXISTS "Usuários podem ver turnos ativos" ON public.turnos;
DROP POLICY IF EXISTS "Admin pode gerenciar turnos" ON public.turnos;

-- Permitir usuários verem turnos da sua instituição
CREATE POLICY "Usuários podem ver turnos da sua instituição"
ON public.turnos
FOR SELECT
USING (
  has_role(auth.uid(), 'SUPER_ADMIN'::user_role)
  OR instituicao_id = get_user_instituicao(auth.uid())
  OR instituicao_id IS NULL
);

-- Admin pode gerenciar turnos da sua instituição
CREATE POLICY "Admin pode gerenciar turnos da sua instituição"
ON public.turnos
FOR ALL
USING (
  has_role(auth.uid(), 'SUPER_ADMIN'::user_role)
  OR (has_role(auth.uid(), 'ADMIN'::user_role) AND (instituicao_id = get_user_instituicao(auth.uid()) OR instituicao_id IS NULL))
)
WITH CHECK (
  has_role(auth.uid(), 'SUPER_ADMIN'::user_role)
  OR (has_role(auth.uid(), 'ADMIN'::user_role) AND (instituicao_id IS NULL OR instituicao_id = get_user_instituicao(auth.uid())))
);