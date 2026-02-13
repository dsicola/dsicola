-- Adicionar coluna instituicao_id à tabela emails_enviados
ALTER TABLE public.emails_enviados 
ADD COLUMN instituicao_id uuid REFERENCES public.instituicoes(id);

-- Criar índice para melhor performance
CREATE INDEX idx_emails_enviados_instituicao ON public.emails_enviados(instituicao_id);

-- Atualizar políticas RLS para filtrar por instituição
DROP POLICY IF EXISTS "Admin e Secretaria veem emails enviados" ON public.emails_enviados;

CREATE POLICY "Admin e Secretaria veem emails da sua instituição" 
ON public.emails_enviados 
FOR SELECT 
USING (
  has_role(auth.uid(), 'SUPER_ADMIN'::user_role) OR
  (
    (has_role(auth.uid(), 'ADMIN'::user_role) OR has_role(auth.uid(), 'SECRETARIA'::user_role))
    AND (instituicao_id = get_user_instituicao(auth.uid()) OR instituicao_id IS NULL)
  )
);

DROP POLICY IF EXISTS "Admin pode excluir emails" ON public.emails_enviados;

CREATE POLICY "Admin pode excluir emails da sua instituição" 
ON public.emails_enviados 
FOR DELETE 
USING (
  has_role(auth.uid(), 'SUPER_ADMIN'::user_role) OR
  (
    has_role(auth.uid(), 'ADMIN'::user_role)
    AND (instituicao_id = get_user_instituicao(auth.uid()) OR instituicao_id IS NULL)
  )
);