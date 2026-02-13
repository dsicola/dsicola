-- ============================================================
-- MIGRAÇÃO: Atualizar plano_ensino.professor_id
-- ============================================================
-- OBJETIVO: Migrar plano_ensino.professor_id de users.id para professores.id
-- ============================================================
-- ANTES: plano_ensino.professor_id = users.id
-- DEPOIS: plano_ensino.professor_id = professores.id
-- ============================================================
-- CARACTERÍSTICAS:
-- - IDEMPOTENTE: pode ser executado múltiplas vezes sem erro
-- - SEGURO: não apaga planos, apenas atualiza referências
-- - MULTI-TENANT: preserva isolamento por instituição
-- ============================================================
-- DATA: 2025-01-XX
-- SISTEMA: DSICOLA
-- ============================================================

BEGIN;

-- ============================================================
-- ETAPA 1: VALIDAÇÃO PRÉ-MIGRAÇÃO
-- ============================================================
DO $$
DECLARE
  total_planos INTEGER;
  planos_com_professor_id INTEGER;
  planos_sem_professor INTEGER;
  planos_com_professor_invalido INTEGER;
  planos_ja_migrados INTEGER;
  planos_a_migrar INTEGER;
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  MIGRANDO PLANO_ENSINO.PROFESSOR_ID';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  
  -- Total de planos
  SELECT COUNT(*) INTO total_planos FROM plano_ensino;
  
  -- Planos com professor_id preenchido
  SELECT COUNT(*) INTO planos_com_professor_id
  FROM plano_ensino
  WHERE professor_id IS NOT NULL;
  
  -- Planos que já estão migrados (professor_id aponta para professores.id)
  SELECT COUNT(*) INTO planos_ja_migrados
  FROM plano_ensino pe
  WHERE pe.professor_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM professores p WHERE p.id = pe.professor_id
    );
  
  -- Planos que precisam ser migrados (professor_id aponta para users.id)
  SELECT COUNT(*) INTO planos_a_migrar
  FROM plano_ensino pe
  WHERE pe.professor_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM professores p WHERE p.id = pe.professor_id
    )
    AND EXISTS (
      SELECT 1 FROM users u WHERE u.id = pe.professor_id
    )
    AND EXISTS (
      SELECT 1 
      FROM professores p
      WHERE p.user_id = pe.professor_id
        AND p.instituicao_id = COALESCE(pe.instituicao_id, (
          SELECT u.instituicao_id FROM users u WHERE u.id = pe.professor_id
        ))
    );
  
  -- Planos sem professor correspondente na tabela professores
  SELECT COUNT(*) INTO planos_sem_professor
  FROM plano_ensino pe
  WHERE pe.professor_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 
      FROM professores p
      WHERE p.user_id = pe.professor_id
        AND p.instituicao_id = COALESCE(pe.instituicao_id, (
          SELECT u.instituicao_id 
          FROM users u 
          WHERE u.id = pe.professor_id
        ))
    );
  
  -- Planos com professor_id que não corresponde a nenhum user com role PROFESSOR
  SELECT COUNT(*) INTO planos_com_professor_invalido
  FROM plano_ensino pe
  WHERE pe.professor_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 
      FROM users u
      INNER JOIN user_roles ur ON u.id = ur.user_id
      WHERE u.id = pe.professor_id
        AND ur.role = 'PROFESSOR'
    );
  
  RAISE NOTICE '📊 ESTATÍSTICAS ANTES DA MIGRAÇÃO:';
  RAISE NOTICE '  • Total de planos de ensino: %', total_planos;
  RAISE NOTICE '  • Planos com professor_id: %', planos_com_professor_id;
  RAISE NOTICE '  • Planos já migrados (professores.id): %', planos_ja_migrados;
  RAISE NOTICE '  • Planos a migrar (users.id → professores.id): %', planos_a_migrar;
  RAISE NOTICE '';
  
  IF planos_sem_professor > 0 THEN
    RAISE WARNING '  ⚠️  Planos sem professor correspondente: %', planos_sem_professor;
    RAISE WARNING '     Estes planos NÃO serão migrados automaticamente';
    RAISE WARNING '     Execute o script de popular professores primeiro!';
  END IF;
  
  IF planos_com_professor_invalido > 0 THEN
    RAISE WARNING '  ⚠️  Planos com professor_id inválido: %', planos_com_professor_invalido;
    RAISE WARNING '     Estes planos NÃO serão migrados automaticamente';
  END IF;
  
  IF planos_a_migrar = 0 THEN
    RAISE NOTICE '✅ Todos os planos já estão migrados. Nada a fazer.';
    RAISE NOTICE '';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- ============================================================
-- ETAPA 2: CRIAR TABELA TEMPORÁRIA PARA MAPEAMENTO
-- ============================================================
-- Esta tabela armazena o mapeamento users.id → professores.id
-- para garantir que a migração seja segura e rastreável

CREATE TEMP TABLE IF NOT EXISTS plano_ensino_migration_map AS
SELECT 
  pe.id as plano_id,
  pe.professor_id as old_professor_id, -- users.id (atual)
  p.id as new_professor_id, -- professores.id (novo)
  pe.instituicao_id,
  u.nome_completo as professor_nome
FROM plano_ensino pe
INNER JOIN users u ON u.id = pe.professor_id
INNER JOIN professores p ON p.user_id = pe.professor_id
WHERE pe.professor_id IS NOT NULL
  -- Garantir que professor pertence à mesma instituição do plano
  AND p.instituicao_id = COALESCE(pe.instituicao_id, u.instituicao_id)
  -- Apenas planos que ainda não foram migrados
  AND NOT EXISTS (
    SELECT 1 FROM professores p2 WHERE p2.id = pe.professor_id
  );

-- ============================================================
-- ETAPA 3: ATUALIZAR PLANO_ENSINO.PROFESSOR_ID
-- ============================================================
-- IMPORTANTE: Esta migração é idempotente
-- IMPORTANTE: Apenas atualiza se professor_id for diferente
-- IMPORTANTE: Preserva multi-tenant (valida instituicao_id)

UPDATE plano_ensino pe
SET professor_id = pem.new_professor_id
FROM plano_ensino_migration_map pem
WHERE pe.id = pem.plano_id
  AND pe.professor_id != pem.new_professor_id; -- Apenas atualizar se diferente

-- ============================================================
-- ETAPA 4: VALIDAÇÃO PÓS-MIGRAÇÃO
-- ============================================================
DO $$
DECLARE
  total_planos INTEGER;
  total_atualizados INTEGER;
  planos_ainda_com_user_id INTEGER;
  planos_com_professor_id_valido INTEGER;
  planos_sem_professor_id INTEGER;
BEGIN
  -- Total de planos
  SELECT COUNT(*) INTO total_planos FROM plano_ensino;
  
  -- Planos que agora referenciam professores.id corretamente
  SELECT COUNT(*) INTO planos_com_professor_id_valido
  FROM plano_ensino pe
  WHERE pe.professor_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM professores p WHERE p.id = pe.professor_id
    );
  
  -- Planos que ainda referenciam users.id diretamente (não deveria acontecer)
  SELECT COUNT(*) INTO planos_ainda_com_user_id
  FROM plano_ensino pe
  WHERE pe.professor_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM professores p WHERE p.id = pe.professor_id
    )
    AND EXISTS (
      SELECT 1 FROM users u WHERE u.id = pe.professor_id
    );
  
  -- Planos sem professor_id
  SELECT COUNT(*) INTO planos_sem_professor_id
  FROM plano_ensino
  WHERE professor_id IS NULL;
  
  -- Total atualizado nesta execução
  SELECT COUNT(*) INTO total_atualizados
  FROM plano_ensino_migration_map;
  
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  RESULTADO DA MIGRAÇÃO';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📊 ESTATÍSTICAS:';
  RAISE NOTICE '  • Total de planos: %', total_planos;
  RAISE NOTICE '  • Planos atualizados nesta execução: %', total_atualizados;
  RAISE NOTICE '  • Planos com professor_id válido (professores.id): %', planos_com_professor_id_valido;
  
  IF planos_ainda_com_user_id > 0 THEN
    RAISE WARNING '  ⚠️  Planos ainda referenciando users.id: %', planos_ainda_com_user_id;
    RAISE WARNING '     Execute o script de popular professores primeiro!';
  ELSE
    RAISE NOTICE '  ✅ Todos os planos referenciam professores.id';
  END IF;
  
  IF planos_sem_professor_id > 0 THEN
    RAISE NOTICE '  ℹ️  Planos sem professor_id: % (normal se permitido pelo modelo)', planos_sem_professor_id;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ MIGRAÇÃO DE PLANO_ENSINO CONCLUÍDA';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

-- ============================================================
-- ETAPA 5: LIMPAR TABELA TEMPORÁRIA
-- ============================================================
DROP TABLE IF EXISTS plano_ensino_migration_map;

COMMIT;

