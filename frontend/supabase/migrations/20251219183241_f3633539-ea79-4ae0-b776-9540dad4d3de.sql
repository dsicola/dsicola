-- Adicionar campo numero_identificacao_publica à tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS numero_identificacao_publica TEXT UNIQUE;

-- Criar tabela de sequências para controlar a numeração
CREATE TABLE IF NOT EXISTS public.sequencias_identificacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL UNIQUE,
  ultimo_numero INTEGER NOT NULL DEFAULT 0,
  prefixo TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inserir sequências iniciais para alunos e funcionários
INSERT INTO public.sequencias_identificacao (tipo, ultimo_numero, prefixo) VALUES 
  ('ALUNO', 0, 'ALU'),
  ('FUNCIONARIO', 0, 'FUNC'),
  ('PROFESSOR', 0, 'PROF'),
  ('SECRETARIA', 0, 'SEC'),
  ('ADMIN', 0, 'ADM')
ON CONFLICT (tipo) DO NOTHING;

-- Habilitar RLS na tabela de sequências
ALTER TABLE public.sequencias_identificacao ENABLE ROW LEVEL SECURITY;

-- Política: apenas admins e sistema podem gerenciar sequências
CREATE POLICY "Sistema pode gerenciar sequências" ON public.sequencias_identificacao
FOR ALL USING (true) WITH CHECK (true);

-- Função para gerar o próximo número de identificação pública
CREATE OR REPLACE FUNCTION public.gerar_numero_identificacao_publica(_tipo TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefixo TEXT;
  v_proximo_numero INTEGER;
  v_numero_formatado TEXT;
BEGIN
  -- Obter e incrementar o número
  UPDATE public.sequencias_identificacao
  SET ultimo_numero = ultimo_numero + 1,
      updated_at = now()
  WHERE tipo = _tipo
  RETURNING prefixo, ultimo_numero INTO v_prefixo, v_proximo_numero;
  
  -- Se não encontrou o tipo, usar padrão
  IF v_prefixo IS NULL THEN
    v_prefixo := 'USR';
    v_proximo_numero := (SELECT COALESCE(MAX(ultimo_numero), 0) + 1 FROM sequencias_identificacao);
  END IF;
  
  -- Formatar o número com zeros à esquerda (4 dígitos)
  v_numero_formatado := v_prefixo || LPAD(v_proximo_numero::TEXT, 4, '0');
  
  RETURN v_numero_formatado;
END;
$$;

-- Função para atribuir número de identificação baseado na role
CREATE OR REPLACE FUNCTION public.atribuir_numero_identificacao_publica()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_tipo TEXT;
BEGIN
  -- Só gerar se não tiver número ainda
  IF NEW.numero_identificacao_publica IS NULL THEN
    -- Buscar a role do usuário
    SELECT role::TEXT INTO v_role
    FROM public.user_roles
    WHERE user_id = NEW.id
    LIMIT 1;
    
    -- Mapear role para tipo de sequência
    CASE v_role
      WHEN 'ALUNO' THEN v_tipo := 'ALUNO';
      WHEN 'PROFESSOR' THEN v_tipo := 'PROFESSOR';
      WHEN 'SECRETARIA' THEN v_tipo := 'SECRETARIA';
      WHEN 'ADMIN' THEN v_tipo := 'ADMIN';
      ELSE v_tipo := 'FUNCIONARIO';
    END CASE;
    
    -- Gerar o número
    NEW.numero_identificacao_publica := public.gerar_numero_identificacao_publica(v_tipo);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para gerar número automaticamente ao criar/atualizar profile
DROP TRIGGER IF EXISTS trigger_atribuir_numero_identificacao ON public.profiles;
CREATE TRIGGER trigger_atribuir_numero_identificacao
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.atribuir_numero_identificacao_publica();

-- Atualizar profiles existentes que não têm número de identificação pública
-- Primeiro, vamos criar números para alunos existentes
DO $$
DECLARE
  r RECORD;
  v_numero TEXT;
BEGIN
  -- Atualizar alunos
  FOR r IN 
    SELECT p.id 
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.id
    WHERE ur.role = 'ALUNO' 
    AND p.numero_identificacao_publica IS NULL
    ORDER BY p.created_at
  LOOP
    v_numero := public.gerar_numero_identificacao_publica('ALUNO');
    UPDATE profiles SET numero_identificacao_publica = v_numero WHERE id = r.id;
  END LOOP;
  
  -- Atualizar professores
  FOR r IN 
    SELECT p.id 
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.id
    WHERE ur.role = 'PROFESSOR' 
    AND p.numero_identificacao_publica IS NULL
    ORDER BY p.created_at
  LOOP
    v_numero := public.gerar_numero_identificacao_publica('PROFESSOR');
    UPDATE profiles SET numero_identificacao_publica = v_numero WHERE id = r.id;
  END LOOP;
  
  -- Atualizar funcionários (secretaria, admin, etc.)
  FOR r IN 
    SELECT p.id 
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.id
    WHERE ur.role IN ('SECRETARIA', 'ADMIN', 'SUPER_ADMIN') 
    AND p.numero_identificacao_publica IS NULL
    ORDER BY p.created_at
  LOOP
    v_numero := public.gerar_numero_identificacao_publica('FUNCIONARIO');
    UPDATE profiles SET numero_identificacao_publica = v_numero WHERE id = r.id;
  END LOOP;
END;
$$;