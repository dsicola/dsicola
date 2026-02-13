-- ============================================================
-- MIGRAÇÃO: Popular tabela professores
-- ============================================================
-- OBJETIVO: Criar registros em `professores` para TODOS os usuários
--           que possuem role PROFESSOR e pertencem a uma instituição
-- ============================================================
-- CARACTERÍSTICAS:
-- - IDEMPOTENTE: pode ser executado múltiplas vezes sem erro
-- - SEGURO: não apaga dados existentes
-- - MULTI-TENANT: preserva isolamento por instituição
-- ============================================================
-- DATA: 2025-01-XX
-- SISTEMA: DSICOLA
-- ============================================================

BEGIN;

-- ============================================================
-- ETAPA 1: VALIDAÇÃO PRÉ-INSERÇÃO
-- ============================================================
DO $$
DECLARE
  total_users_professor INTEGER;
  total_professores_existentes INTEGER;
  total_a_criar INTEGER;
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  POPULANDO TABELA PROFESSORES';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  
  -- Contar usuários com role PROFESSOR e instituição
  SELECT COUNT(DISTINCT u.id) INTO total_users_professor
  FROM users u
  INNER JOIN user_roles ur ON u.id = ur.user_id
  WHERE ur.role = 'PROFESSOR'
    AND u.instituicao_id IS NOT NULL;
  
  -- Contar professores já existentes
  SELECT COUNT(*) INTO total_professores_existentes
  FROM professores;
  
  -- Calcular quantos serão criados
  SELECT COUNT(DISTINCT u.id) INTO total_a_criar
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
  
  RAISE NOTICE '📊 ESTATÍSTICAS:';
  RAISE NOTICE '  • Usuários com role PROFESSOR (com instituição): %', total_users_professor;
  RAISE NOTICE '  • Professores já existentes: %', total_professores_existentes;
  RAISE NOTICE '  • Professores a criar: %', total_a_criar;
  RAISE NOTICE '';
  
  IF total_a_criar = 0 THEN
    RAISE NOTICE '✅ Todos os professores já estão na tabela. Nada a fazer.';
    RAISE NOTICE '';
  END IF;
END $$;

-- ============================================================
-- ETAPA 2: INSERIR PROFESSORES
-- ============================================================
-- IMPORTANTE: Usar NOT EXISTS para garantir idempotência
-- IMPORTANTE: Validar instituicao_id para multi-tenant
-- IMPORTANTE: Usar gen_random_uuid() para gerar IDs únicos

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

-- ============================================================
-- ETAPA 3: VALIDAÇÃO PÓS-INSERÇÃO
-- ============================================================
DO $$
DECLARE
  total_professores INTEGER;
  professores_sem_user INTEGER;
  professores_duplicados INTEGER;
BEGIN
  -- Total de professores
  SELECT COUNT(*) INTO total_professores FROM professores;
  
  -- Professores sem user válido
  SELECT COUNT(*) INTO professores_sem_user
  FROM professores p
  WHERE NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = p.user_id
  );
  
  -- Verificar duplicados (não deveria acontecer devido ao UNIQUE)
  SELECT COUNT(*) INTO professores_duplicados
  FROM (
    SELECT user_id, instituicao_id, COUNT(*) as cnt
    FROM professores
    GROUP BY user_id, instituicao_id
    HAVING COUNT(*) > 1
  ) duplicados;
  
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  RESULTADO DA MIGRAÇÃO';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📊 ESTATÍSTICAS:';
  RAISE NOTICE '  • Total de professores na tabela: %', total_professores;
  
  IF professores_sem_user > 0 THEN
    RAISE WARNING '  ⚠️  Professores sem user válido: %', professores_sem_user;
  ELSE
    RAISE NOTICE '  ✅ Todos os professores têm user válido';
  END IF;
  
  IF professores_duplicados > 0 THEN
    RAISE WARNING '  ⚠️  Professores duplicados detectados: %', professores_duplicados;
    RAISE WARNING '     Isso não deveria acontecer! Verifique constraints.';
  ELSE
    RAISE NOTICE '  ✅ Nenhum duplicado detectado';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ MIGRAÇÃO DE PROFESSORES CONCLUÍDA';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

COMMIT;

