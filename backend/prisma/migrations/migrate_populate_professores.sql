-- ============================================================
-- MIGRAÇÃO: Popular tabela professores
-- ============================================================
-- OBJETIVO: Criar registros em `professores` para TODOS os usuários
--           que possuem role PROFESSOR e pertencem a uma instituição
-- ============================================================
-- DATA: 2025-01-XX
-- SISTEMA: DSICOLA
-- ============================================================

BEGIN;

-- ETAPA 1: Popular tabela professores
-- Criar registros para todos os usuários com role PROFESSOR
-- que ainda não têm registro na tabela professores

INSERT INTO professores (id, user_id, instituicao_id, created_at, updated_at)
SELECT 
  gen_random_uuid() as id,
  u.id as user_id,
  u.instituicao_id as instituicao_id,
  NOW() as created_at,
  NOW() as updated_at
FROM users u
INNER JOIN user_roles ur ON u.id = ur.user_id
WHERE ur.role = 'PROFESSOR'
  AND u.instituicao_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM professores p 
    WHERE p.user_id = u.id 
      AND p.instituicao_id = u.instituicao_id
  );

-- Verificar quantos registros foram criados
DO $$
DECLARE
  total_criados INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_criados
  FROM professores;
  
  RAISE NOTICE 'Total de professores criados: %', total_criados;
END $$;

COMMIT;

