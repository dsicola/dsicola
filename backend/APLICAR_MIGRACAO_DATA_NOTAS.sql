-- ============================================
-- MIGRAÇÃO URGENTE: Adicionar data_inicio_notas e data_fim_notas
-- ============================================
-- Execute este script diretamente no banco de dados PostgreSQL
-- 
-- IMPORTANTE: Esta migração é idempotente (pode ser executada múltiplas vezes)
-- ============================================

-- ============================================
-- SEMESTRES
-- ============================================

-- Adicionar data_inicio_notas (se não existir)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'semestres') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'semestres' 
      AND column_name = 'data_inicio_notas'
    ) THEN
      ALTER TABLE "public"."semestres" ADD COLUMN "data_inicio_notas" TIMESTAMP(3);
      RAISE NOTICE '✅ Coluna data_inicio_notas adicionada à tabela semestres';
    ELSE
      RAISE NOTICE 'ℹ️  Coluna data_inicio_notas já existe na tabela semestres';
    END IF;
  ELSE
    RAISE NOTICE '⚠️  Tabela semestres não existe ainda';
  END IF;
END $$;

-- Adicionar data_fim_notas (se não existir)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'semestres') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'semestres' 
      AND column_name = 'data_fim_notas'
    ) THEN
      ALTER TABLE "public"."semestres" ADD COLUMN "data_fim_notas" TIMESTAMP(3);
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

-- Adicionar data_inicio_notas (se não existir)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trimestres') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'trimestres' 
      AND column_name = 'data_inicio_notas'
    ) THEN
      ALTER TABLE "public"."trimestres" ADD COLUMN "data_inicio_notas" TIMESTAMP(3);
      RAISE NOTICE '✅ Coluna data_inicio_notas adicionada à tabela trimestres';
    ELSE
      RAISE NOTICE 'ℹ️  Coluna data_inicio_notas já existe na tabela trimestres';
    END IF;
  ELSE
    RAISE NOTICE '⚠️  Tabela trimestres não existe ainda';
  END IF;
END $$;

-- Adicionar data_fim_notas (se não existir)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trimestres') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'trimestres' 
      AND column_name = 'data_fim_notas'
    ) THEN
      ALTER TABLE "public"."trimestres" ADD COLUMN "data_fim_notas" TIMESTAMP(3);
      RAISE NOTICE '✅ Coluna data_fim_notas adicionada à tabela trimestres';
    ELSE
      RAISE NOTICE 'ℹ️  Coluna data_fim_notas já existe na tabela trimestres';
    END IF;
  ELSE
    RAISE NOTICE '⚠️  Tabela trimestres não existe ainda';
  END IF;
END $$;

-- Verificar resultado
SELECT 
  'semestres' as tabela,
  COUNT(*) as total,
  COUNT("data_inicio_notas") as com_data_inicio_notas,
  COUNT("data_fim_notas") as com_data_fim_notas
FROM "public"."semestres"
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'semestres')
UNION ALL
SELECT 
  'trimestres' as tabela,
  COUNT(*) as total,
  COUNT("data_inicio_notas") as com_data_inicio_notas,
  COUNT("data_fim_notas") as com_data_fim_notas
FROM "public"."trimestres"
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trimestres');

RAISE NOTICE '✅ Migração concluída!';

