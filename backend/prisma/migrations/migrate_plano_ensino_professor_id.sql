-- ============================================================
-- MIGRAÇÃO: Atualizar plano_ensino.professor_id
-- ============================================================
-- OBJETIVO: Migrar plano_ensino.professor_id de users.id para professores.id
-- ============================================================
-- ANTES: plano_ensino.professor_id = users.id
-- DEPOIS: plano_ensino.professor_id = professores.id
-- ============================================================
-- DATA: 2025-01-XX
-- SISTEMA: DSICOLA
-- ============================================================

BEGIN;

-- ETAPA 1: Verificar dados antes da migração
DO $$
DECLARE
  total_planos INTEGER;
  planos_sem_professor INTEGER;
  planos_com_professor_invalido INTEGER;
BEGIN
  -- Total de planos
  SELECT COUNT(*) INTO total_planos FROM plano_ensino;
  
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
  
  RAISE NOTICE '=== ESTATÍSTICAS ANTES DA MIGRAÇÃO ===';
  RAISE NOTICE 'Total de planos de ensino: %', total_planos;
  RAISE NOTICE 'Planos sem professor correspondente: %', planos_sem_professor;
  RAISE NOTICE 'Planos com professor_id inválido: %', planos_com_professor_invalido;
  
  IF planos_sem_professor > 0 OR planos_com_professor_invalido > 0 THEN
    RAISE WARNING '⚠️ Existem planos que não podem ser migrados automaticamente!';
  END IF;
END $$;

-- ETAPA 2: Criar tabela temporária para armazenar mapeamento
CREATE TEMP TABLE IF NOT EXISTS plano_ensino_migration_map AS
SELECT 
  pe.id as plano_id,
  pe.professor_id as old_professor_id, -- users.id
  p.id as new_professor_id, -- professores.id
  pe.instituicao_id
FROM plano_ensino pe
INNER JOIN professores p ON p.user_id = pe.professor_id
WHERE pe.professor_id IS NOT NULL
  AND p.instituicao_id = COALESCE(pe.instituicao_id, (
    SELECT u.instituicao_id 
    FROM users u 
    WHERE u.id = pe.professor_id
  ));

-- ETAPA 3: Atualizar plano_ensino.professor_id
-- IMPORTANTE: Esta migração é idempotente - pode ser executada múltiplas vezes
UPDATE plano_ensino pe
SET professor_id = pem.new_professor_id
FROM plano_ensino_migration_map pem
WHERE pe.id = pem.plano_id
  AND pe.professor_id != pem.new_professor_id; -- Apenas atualizar se diferente

-- ETAPA 4: Verificar resultados
DO $$
DECLARE
  total_atualizados INTEGER;
  total_planos INTEGER;
  planos_ainda_com_user_id INTEGER;
BEGIN
  -- Total de planos atualizados
  SELECT COUNT(*) INTO total_atualizados
  FROM plano_ensino pe
  INNER JOIN professores p ON pe.professor_id = p.id;
  
  -- Total de planos
  SELECT COUNT(*) INTO total_planos FROM plano_ensino;
  
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
  
  RAISE NOTICE '=== ESTATÍSTICAS APÓS A MIGRAÇÃO ===';
  RAISE NOTICE 'Total de planos: %', total_planos;
  RAISE NOTICE 'Planos migrados (referenciando professores.id): %', total_atualizados;
  RAISE NOTICE 'Planos ainda com users.id: %', planos_ainda_com_user_id;
  
  IF planos_ainda_com_user_id > 0 THEN
    RAISE WARNING '⚠️ Ainda existem planos referenciando users.id diretamente!';
  END IF;
END $$;

-- ETAPA 5: Limpar tabela temporária
DROP TABLE IF EXISTS plano_ensino_migration_map;

COMMIT;

