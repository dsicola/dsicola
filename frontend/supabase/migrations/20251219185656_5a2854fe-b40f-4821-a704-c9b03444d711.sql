-- Adicionar coluna instituicao_id à tabela logs_auditoria
ALTER TABLE public.logs_auditoria 
ADD COLUMN instituicao_id uuid REFERENCES public.instituicoes(id);

-- Criar índice para melhor performance
CREATE INDEX idx_logs_auditoria_instituicao ON public.logs_auditoria(instituicao_id);

-- Atualizar políticas RLS
DROP POLICY IF EXISTS "ADMIN pode ver logs" ON public.logs_auditoria;
DROP POLICY IF EXISTS "SUPER_ADMIN pode ver logs" ON public.logs_auditoria;

-- Política para SUPER_ADMIN ver todos os logs
CREATE POLICY "SUPER_ADMIN pode ver todos logs" 
ON public.logs_auditoria 
FOR SELECT 
USING (has_role(auth.uid(), 'SUPER_ADMIN'::user_role));

-- Política para ADMIN ver apenas logs da sua instituição
CREATE POLICY "ADMIN pode ver logs da sua instituição" 
ON public.logs_auditoria 
FOR SELECT 
USING (
  has_role(auth.uid(), 'ADMIN'::user_role) 
  AND (instituicao_id = get_user_instituicao(auth.uid()) OR instituicao_id IS NULL)
);

-- Atualizar função de registro para incluir instituicao_id
CREATE OR REPLACE FUNCTION public.registrar_log_auditoria(
  _acao text, 
  _tabela text DEFAULT NULL::text, 
  _registro_id text DEFAULT NULL::text, 
  _dados_anteriores jsonb DEFAULT NULL::jsonb, 
  _dados_novos jsonb DEFAULT NULL::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id UUID;
  _user_email TEXT;
  _user_nome TEXT;
  _instituicao_id UUID;
BEGIN
  _user_id := auth.uid();
  
  IF _user_id IS NOT NULL THEN
    SELECT email, nome_completo, instituicao_id 
    INTO _user_email, _user_nome, _instituicao_id
    FROM public.profiles
    WHERE id = _user_id;
  END IF;
  
  INSERT INTO public.logs_auditoria (
    user_id, user_email, user_nome, acao, tabela, registro_id, dados_anteriores, dados_novos, instituicao_id
  ) VALUES (
    _user_id, _user_email, _user_nome, _acao, _tabela, _registro_id, _dados_anteriores, _dados_novos, _instituicao_id
  );
END;
$function$;