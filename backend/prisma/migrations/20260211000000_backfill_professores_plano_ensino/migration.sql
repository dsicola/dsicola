-- ============================================================
-- MIGRAÇÃO: Backfill professores + corrigir plano_ensino.professor_id
-- ============================================================
-- OBJETIVO: 
-- 1. Popular tabela professores para users com role PROFESSOR
-- 2. Corrigir plano_ensino.professor_id de users.id para professores.id
-- ============================================================
-- IDEMPOTENTE: Pode ser executada múltiplas vezes com segurança
-- ============================================================
-- SISTEMA: DSICOLA
-- DATA: 2025-02-11
-- ============================================================

BEGIN;

-- ========== ETAPA 1: Popular tabela professores ==========
-- Criar registros para users com role PROFESSOR que ainda não têm registro
-- Usar user.instituicao_id OU user_roles.instituicao_id como fallback
-- NOTA: Professor.userId é @unique - um user só pode ter um registro por tabela
-- Usar DISTINCT ON para evitar duplicatas quando user tem múltiplos user_roles

INSERT INTO professores (id, user_id, instituicao_id, created_at, updated_at)
SELECT DISTINCT ON (u.id)
  gen_random_uuid() as id,
  u.id as user_id,
  COALESCE(u.instituicao_id, ur.instituicao_id) as instituicao_id,
  NOW() as created_at,
  NOW() as updated_at
FROM users u
INNER JOIN user_roles ur ON u.id = ur.user_id AND ur.role = 'PROFESSOR'
WHERE COALESCE(u.instituicao_id, ur.instituicao_id) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM professores p 
    WHERE p.user_id = u.id
  );

-- Log: quantos professores foram criados
DO $$
DECLARE
  total_professores INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_professores FROM professores;
  RAISE NOTICE '[backfill] Total de professores na tabela: %', total_professores;
END $$;

-- ========== ETAPA 2: Corrigir plano_ensino.professor_id ==========
-- Atualizar planos que têm professor_id = users.id para professors.id
-- JOIN: professores.user_id = plano_ensino.professor_id (quando professor_id é users.id)
-- CRÍTICO: Sempre filtrar por instituicao_id para evitar vazamento multi-tenant

CREATE TEMP TABLE IF NOT EXISTS plano_ensino_professor_map AS
SELECT 
  pe.id as plano_id,
  pe.professor_id as old_professor_id,
  p.id as new_professor_id
FROM plano_ensino pe
INNER JOIN professores p ON p.user_id = pe.professor_id 
  AND p.instituicao_id = pe.instituicao_id
WHERE pe.professor_id IS NOT NULL
  AND pe.professor_id != p.id
  AND NOT EXISTS (SELECT 1 FROM professores p2 WHERE p2.id = pe.professor_id);

-- Atualizar apenas planos que referenciam users.id (não professores.id)
UPDATE plano_ensino pe
SET professor_id = pem.new_professor_id,
    updated_at = NOW()
FROM plano_ensino_professor_map pem
WHERE pe.id = pem.plano_id
  AND pe.professor_id = pem.old_professor_id;

-- Log: quantos planos foram corrigidos
DO $$
DECLARE
  planos_corrigidos INTEGER;
  total_planos INTEGER;
  planos_com_professor_valido INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_planos FROM plano_ensino;
  
  SELECT COUNT(*) INTO planos_com_professor_valido
  FROM plano_ensino pe
  INNER JOIN professores p ON pe.professor_id = p.id;
  
  planos_corrigidos := (SELECT COUNT(*) FROM plano_ensino_professor_map);
  
  RAISE NOTICE '[backfill] Total de planos de ensino: %', total_planos;
  RAISE NOTICE '[backfill] Planos com professor_id válido (professores.id): %', planos_com_professor_valido;
  RAISE NOTICE '[backfill] Planos corrigidos (users.id -> professores.id): %', planos_corrigidos;
END $$;

DROP TABLE IF EXISTS plano_ensino_professor_map;

COMMIT;
