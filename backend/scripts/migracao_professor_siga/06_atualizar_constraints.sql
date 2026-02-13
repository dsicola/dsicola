-- ============================================================
-- MIGRAÇÃO: Atualizar constraints após migração de dados
-- ============================================================
-- OBJETIVO: Atualizar foreign key constraint de plano_ensino.professor_id
--           de users.id para professores.id
-- ============================================================
-- ANTES: plano_ensino.professor_id → users.id
-- DEPOIS: plano_ensino.professor_id → professores.id
-- ============================================================
-- DATA: 2025-01-XX
-- SISTEMA: DSICOLA
-- ============================================================
-- IMPORTANTE: Execute este script APENAS após:
--   1. Popular tabela professores (03_popular_professores.sql)
--   2. Migrar dados de plano_ensino (04_migrar_plano_ensino.sql)
--   3. Verificar que todos os planos referenciam professores.id
-- ============================================================

BEGIN;

-- ============================================================
-- ETAPA 1: VALIDAÇÃO PRÉ-ATUALIZAÇÃO
-- ============================================================
DO $$
DECLARE
  planos_com_professor_id INTEGER;
  planos_com_professor_valido INTEGER;
  planos_ainda_com_user_id INTEGER;
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  ATUALIZANDO CONSTRAINTS';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  
  -- Contar planos com professor_id
  SELECT COUNT(*) INTO planos_com_professor_id
  FROM plano_ensino
  WHERE professor_id IS NOT NULL;
  
  -- Contar planos que referenciam professores.id corretamente
  SELECT COUNT(*) INTO planos_com_professor_valido
  FROM plano_ensino pe
  WHERE pe.professor_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM professores p WHERE p.id = pe.professor_id
    );
  
  -- Contar planos que ainda referenciam users.id
  SELECT COUNT(*) INTO planos_ainda_com_user_id
  FROM plano_ensino pe
  WHERE pe.professor_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM professores p WHERE p.id = pe.professor_id
    )
    AND EXISTS (
      SELECT 1 FROM users u WHERE u.id = pe.professor_id
    );
  
  RAISE NOTICE '📊 ESTATÍSTICAS:';
  RAISE NOTICE '  • Planos com professor_id: %', planos_com_professor_id;
  RAISE NOTICE '  • Planos referenciando professores.id: %', planos_com_professor_valido;
  RAISE NOTICE '  • Planos ainda referenciando users.id: %', planos_ainda_com_user_id;
  RAISE NOTICE '';
  
  IF planos_ainda_com_user_id > 0 THEN
    RAISE EXCEPTION '❌ ERRO: Existem planos ainda referenciando users.id. Execute o script de migração de dados primeiro!';
  END IF;
  
  IF planos_com_professor_valido != planos_com_professor_id THEN
    RAISE EXCEPTION '❌ ERRO: Nem todos os planos referenciam professores.id corretamente. Revise a migração de dados!';
  END IF;
  
  RAISE NOTICE '✅ Validação passou. Prosseguindo com atualização de constraints...';
  RAISE NOTICE '';
END $$;

-- ============================================================
-- ETAPA 2: REMOVER CONSTRAINT ANTIGA
-- ============================================================
-- Remover foreign key constraint que referencia users.id
-- IMPORTANTE: Esta operação pode falhar se a constraint não existir
--             ou se tiver nome diferente. Isso é normal.

DO $$
BEGIN
  -- Tentar remover constraint antiga (pode não existir se já foi removida)
  BEGIN
    ALTER TABLE plano_ensino 
    DROP CONSTRAINT IF EXISTS plano_ensino_professor_id_fkey;
    
    RAISE NOTICE '✅ Constraint antiga removida (ou não existia)';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'ℹ️  Constraint antiga não encontrada (pode já ter sido removida)';
  END;
END $$;

-- ============================================================
-- ETAPA 3: CRIAR CONSTRAINT NOVA
-- ============================================================
-- Criar foreign key constraint que referencia professores.id
-- IMPORTANTE: Esta constraint garante integridade referencial

DO $$
BEGIN
  -- Criar constraint nova
  ALTER TABLE plano_ensino
  ADD CONSTRAINT plano_ensino_professor_id_fkey
  FOREIGN KEY (professor_id)
  REFERENCES professores(id)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
  
  RAISE NOTICE '✅ Constraint nova criada: plano_ensino.professor_id → professores.id';
END $$;

-- ============================================================
-- ETAPA 4: VALIDAÇÃO PÓS-ATUALIZAÇÃO
-- ============================================================
DO $$
DECLARE
  constraint_existe BOOLEAN;
  constraint_referencia_correta BOOLEAN;
BEGIN
  -- Verificar se constraint existe
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    INNER JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_name = 'plano_ensino'
      AND tc.constraint_name = 'plano_ensino_professor_id_fkey'
      AND tc.constraint_type = 'FOREIGN KEY'
  ) INTO constraint_existe;
  
  -- Verificar se constraint referencia professores.id
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    INNER JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    INNER JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.table_name = 'plano_ensino'
      AND tc.constraint_name = 'plano_ensino_professor_id_fkey'
      AND ccu.table_name = 'professores'
      AND ccu.column_name = 'id'
  ) INTO constraint_referencia_correta;
  
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  RESULTADO DA ATUALIZAÇÃO';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  
  IF constraint_existe THEN
    RAISE NOTICE '✅ Constraint existe';
  ELSE
    RAISE WARNING '⚠️  Constraint não encontrada';
  END IF;
  
  IF constraint_referencia_correta THEN
    RAISE NOTICE '✅ Constraint referencia professores.id corretamente';
  ELSE
    RAISE WARNING '⚠️  Constraint não referencia professores.id';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ ATUALIZAÇÃO DE CONSTRAINTS CONCLUÍDA';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

COMMIT;

