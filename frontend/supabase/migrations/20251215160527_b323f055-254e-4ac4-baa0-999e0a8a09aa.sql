-- Tabela de bolsas/descontos
CREATE TABLE public.bolsas_descontos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'percentual', -- percentual, valor_fixo
  valor NUMERIC NOT NULL DEFAULT 0,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de aplicação de bolsas aos alunos
CREATE TABLE public.aluno_bolsas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bolsa_id UUID NOT NULL REFERENCES public.bolsas_descontos(id) ON DELETE CASCADE,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(aluno_id, bolsa_id)
);

-- Tabela de logs de auditoria
CREATE TABLE public.logs_auditoria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  user_email TEXT,
  user_nome TEXT,
  acao TEXT NOT NULL,
  tabela TEXT,
  registro_id TEXT,
  dados_anteriores JSONB,
  dados_novos JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.bolsas_descontos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aluno_bolsas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_auditoria ENABLE ROW LEVEL SECURITY;

-- Políticas para bolsas_descontos
CREATE POLICY "Admins podem gerenciar bolsas"
ON public.bolsas_descontos
FOR ALL
USING (has_role(auth.uid(), 'ADMIN'::user_role));

CREATE POLICY "Secretaria pode ver bolsas"
ON public.bolsas_descontos
FOR SELECT
USING (has_role(auth.uid(), 'SECRETARIA'::user_role));

CREATE POLICY "Secretaria pode gerenciar bolsas"
ON public.bolsas_descontos
FOR ALL
USING (has_role(auth.uid(), 'SECRETARIA'::user_role));

-- Políticas para aluno_bolsas
CREATE POLICY "Admins podem gerenciar bolsas de alunos"
ON public.aluno_bolsas
FOR ALL
USING (has_role(auth.uid(), 'ADMIN'::user_role));

CREATE POLICY "Secretaria pode gerenciar bolsas de alunos"
ON public.aluno_bolsas
FOR ALL
USING (has_role(auth.uid(), 'SECRETARIA'::user_role));

CREATE POLICY "Alunos podem ver suas bolsas"
ON public.aluno_bolsas
FOR SELECT
USING (aluno_id = auth.uid());

-- Políticas para logs_auditoria
CREATE POLICY "Admins podem ver logs"
ON public.logs_auditoria
FOR SELECT
USING (has_role(auth.uid(), 'ADMIN'::user_role));

CREATE POLICY "Sistema pode inserir logs"
ON public.logs_auditoria
FOR INSERT
WITH CHECK (true);

-- Triggers para updated_at
CREATE TRIGGER update_bolsas_descontos_updated_at
BEFORE UPDATE ON public.bolsas_descontos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_aluno_bolsas_updated_at
BEFORE UPDATE ON public.aluno_bolsas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para registrar logs de auditoria
CREATE OR REPLACE FUNCTION public.registrar_log_auditoria(
  _acao TEXT,
  _tabela TEXT DEFAULT NULL,
  _registro_id TEXT DEFAULT NULL,
  _dados_anteriores JSONB DEFAULT NULL,
  _dados_novos JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID;
  _user_email TEXT;
  _user_nome TEXT;
BEGIN
  _user_id := auth.uid();
  
  IF _user_id IS NOT NULL THEN
    SELECT email, nome_completo INTO _user_email, _user_nome
    FROM public.profiles
    WHERE id = _user_id;
  END IF;
  
  INSERT INTO public.logs_auditoria (
    user_id, user_email, user_nome, acao, tabela, registro_id, dados_anteriores, dados_novos
  ) VALUES (
    _user_id, _user_email, _user_nome, _acao, _tabela, _registro_id, _dados_anteriores, _dados_novos
  );
END;
$$;