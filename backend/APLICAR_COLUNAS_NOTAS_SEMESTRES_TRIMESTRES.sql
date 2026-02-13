-- ============================================
-- MIGRAÇÃO DEFINITIVA: Adicionar colunas de controle de notas
-- ============================================
-- Execute este script diretamente no banco de dados PostgreSQL
-- 
-- IMPORTANTE: Esta migração é idempotente (pode ser executada múltiplas vezes)
-- ============================================

-- ============================================
-- SEMESTRES
-- ============================================

-- Adicionar data_inicio_notas em semestres (se não existir)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'semestres') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'semestres' 
      AND column_name = 'data_inicio_notas'
    ) THEN
      ALTER TABLE "public"."semestres" 
      ADD COLUMN "data_inicio_notas" TIMESTAMP(3);
      
      RAISE NOTICE '✅ Coluna data_inicio_notas adicionada à tabela semestres';
    ELSE
      RAISE NOTICE 'ℹ️  Coluna data_inicio_notas já existe na tabela semestres';
    END IF;
  ELSE
    RAISE NOTICE '⚠️  Tabela semestres não existe ainda';
  END IF;
END $$;

-- Adicionar data_fim_notas em semestres (se não existir)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'semestres') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'semestres' 
      AND column_name = 'data_fim_notas'
    ) THEN
      ALTER TABLE "public"."semestres" 
      ADD COLUMN "data_fim_notas" TIMESTAMP(3);
      
      RAISE NOTICE '✅ Coluna data_fim_notas adicionada à tabela semestres';
    ELSE
      RAISE NOTICE 'ℹ️  Coluna data_fim_notas já existe na tabela semestres';
    END IF;
  ELSE
    RAISE NOTICE '⚠️  Tabela semestres não existe ainda';
  END IF;
END $$;

-- ============================================
-- TRIMESTRES
-- ============================================

-- Adicionar data_inicio_notas em trimestres (se não existir)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trimestres') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'trimestres' 
      AND column_name = 'data_inicio_notas'
    ) THEN
      ALTER TABLE "public"."trimestres" 
      ADD COLUMN "data_inicio_notas" TIMESTAMP(3);
      
      RAISE NOTICE '✅ Coluna data_inicio_notas adicionada à tabela trimestres';
    ELSE
      RAISE NOTICE 'ℹ️  Coluna data_inicio_notas já existe na tabela trimestres';
    END IF;
  ELSE
    RAISE NOTICE '⚠️  Tabela trimestres não existe ainda';
  END IF;
END $$;

-- Adicionar data_fim_notas em trimestres (se não existir)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trimestres') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'trimestres' 
      AND column_name = 'data_fim_notas'
    ) THEN
      ALTER TABLE "public"."trimestres" 
      ADD COLUMN "data_fim_notas" TIMESTAMP(3);
      
      RAISE NOTICE '✅ Coluna data_fim_notas adicionada à tabela trimestres';
    ELSE
      RAISE NOTICE 'ℹ️  Coluna data_fim_notas já existe na tabela trimestres';
    END IF;
  ELSE
    RAISE NOTICE '⚠️  Tabela trimestres não existe ainda';
  END IF;
END $$;

-- ============================================
-- VERIFICAÇÃO FINAL
-- ============================================

-- Verificar colunas em semestres
SELECT 
    'semestres' as tabela,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'semestres'
AND column_name IN ('data_inicio_notas', 'data_fim_notas')
ORDER BY column_name;

-- Verificar colunas em trimestres
SELECT 
    'trimestres' as tabela,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'trimestres'
AND column_name IN ('data_inicio_notas', 'data_fim_notas')
ORDER BY column_name;

-- Resumo final
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'semestres' 
            AND column_name = 'data_inicio_notas'
        ) AND EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'semestres' 
            AND column_name = 'data_fim_notas'
        ) THEN '✅ Semestres: Colunas OK'
        ELSE '❌ Semestres: Colunas faltando'
    END as status_semestres,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'trimestres' 
            AND column_name = 'data_inicio_notas'
        ) AND EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'trimestres' 
            AND column_name = 'data_fim_notas'
        ) THEN '✅ Trimestres: Colunas OK'
        ELSE '❌ Trimestres: Colunas faltando'
    END as status_trimestres;

