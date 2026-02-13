-- Função para verificar limite de professores
CREATE OR REPLACE FUNCTION public.verificar_limite_professores(_instituicao_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.limite_professores IS NULL OR 
            (SELECT COUNT(*) FROM profiles pr 
             JOIN user_roles ur ON ur.user_id = pr.id 
             WHERE pr.instituicao_id = _instituicao_id AND ur.role = 'PROFESSOR') < p.limite_professores
     FROM assinaturas a
     JOIN planos p ON p.id = a.plano_id
     WHERE a.instituicao_id = _instituicao_id AND a.status = 'ativa'),
    true
  )
$$;

-- Função para verificar limite de cursos
CREATE OR REPLACE FUNCTION public.verificar_limite_cursos(_instituicao_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.limite_cursos IS NULL OR 
            (SELECT COUNT(*) FROM cursos 
             WHERE instituicao_id = _instituicao_id) < p.limite_cursos
     FROM assinaturas a
     JOIN planos p ON p.id = a.plano_id
     WHERE a.instituicao_id = _instituicao_id AND a.status = 'ativa'),
    true
  )
$$;

-- Função para obter informações de uso atual da instituição
CREATE OR REPLACE FUNCTION public.get_uso_instituicao(_instituicao_id uuid)
RETURNS TABLE(
  alunos_atual bigint,
  alunos_limite integer,
  professores_atual bigint,
  professores_limite integer,
  cursos_atual bigint,
  cursos_limite integer,
  plano_nome text,
  assinatura_status text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    (SELECT COUNT(*) FROM profiles pr JOIN user_roles ur ON ur.user_id = pr.id WHERE pr.instituicao_id = _instituicao_id AND ur.role = 'ALUNO'),
    p.limite_alunos,
    (SELECT COUNT(*) FROM profiles pr JOIN user_roles ur ON ur.user_id = pr.id WHERE pr.instituicao_id = _instituicao_id AND ur.role = 'PROFESSOR'),
    p.limite_professores,
    (SELECT COUNT(*) FROM cursos WHERE instituicao_id = _instituicao_id),
    p.limite_cursos,
    p.nome,
    a.status
  FROM assinaturas a
  JOIN planos p ON p.id = a.plano_id
  WHERE a.instituicao_id = _instituicao_id
$$;