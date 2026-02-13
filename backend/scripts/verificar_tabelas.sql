-- Script SQL para verificar estado das tabelas acadêmicas
-- Execute no PostgreSQL (psql, pgAdmin ou DBeaver)

-- ============================================
-- 1. VERIFICAR EXISTÊNCIA DAS TABELAS
-- ============================================

SELECT 
  'semestres' as tabela,
  EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'semestres'
  ) as existe;

SELECT 
  'trimestres' as tabela,
  EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'trimestres'
  ) as existe;

SELECT 
  'anos_letivos' as tabela,
  EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'anos_letivos'
  ) as existe;

-- ============================================
-- 2. VERIFICAR ESTRUTURA DA TABELA semestres
-- ============================================

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'semestres'
ORDER BY ordinal_position;

-- ============================================
-- 3. VERIFICAR COLUNA ano_letivo_id
-- ============================================

SELECT 
  EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'semestres'
    AND column_name = 'ano_letivo_id'
  ) as tem_ano_letivo_id;

-- ============================================
-- 4. VERIFICAR FOREIGN KEYS
-- ============================================

SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('semestres', 'trimestres', 'anos_letivos')
ORDER BY tc.table_name, tc.constraint_name;

-- ============================================
-- 5. VERIFICAR DADOS EXISTENTES
-- ============================================

SELECT 
  'semestres' as tabela,
  COUNT(*) as total_registros
FROM semestres
UNION ALL
SELECT 
  'trimestres' as tabela,
  COUNT(*) as total_registros
FROM trimestres
UNION ALL
SELECT 
  'anos_letivos' as tabela,
  COUNT(*) as total_registros
FROM anos_letivos;

-- ============================================
-- 6. VERIFICAR MIGRATIONS APLICADAS
-- ============================================

SELECT 
  migration_name,
  finished_at,
  applied_steps_count
FROM "_prisma_migrations"
WHERE migration_name LIKE '%semestre%' 
   OR migration_name LIKE '%trimestre%'
   OR migration_name LIKE '%ano_letivo%'
ORDER BY finished_at DESC;

