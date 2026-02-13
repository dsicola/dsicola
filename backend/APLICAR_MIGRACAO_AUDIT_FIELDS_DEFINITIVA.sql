-- ============================================
-- MIGRAÇÃO DEFINITIVA: Campos de Auditoria Semestres/Trimestres
-- ============================================
-- Esta migração adiciona as colunas de auditoria que estão no Prisma schema
-- mas não existem no banco PostgreSQL, causando erro P2022
-- ============================================

-- ============================================
-- SEMESTRES
-- ============================================

-- Adicionar ativado_por (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'semestres' 
    AND column_name = 'ativado_por'
  ) THEN
    ALTER TABLE "public"."semestres" ADD COLUMN "ativado_por" TEXT;
    RAISE NOTICE '✅ Coluna ativado_por adicionada à tabela semestres';
  ELSE
    RAISE NOTICE 'ℹ️  Coluna ativado_por já existe na tabela semestres';
  END IF;
END $$;

-- Adicionar ativado_em (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'semestres' 
    AND column_name = 'ativado_em'
  ) THEN
    ALTER TABLE "public"."semestres" ADD COLUMN "ativado_em" TIMESTAMP(3);
    RAISE NOTICE '✅ Coluna ativado_em adicionada à tabela semestres';
  ELSE
    RAISE NOTICE 'ℹ️  Coluna ativado_em já existe na tabela semestres';
  END IF;
END $$;

-- Adicionar encerrado_por (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'semestres' 
    AND column_name = 'encerrado_por'
  ) THEN
    ALTER TABLE "public"."semestres" ADD COLUMN "encerrado_por" TEXT;
    RAISE NOTICE '✅ Coluna encerrado_por adicionada à tabela semestres';
  ELSE
    RAISE NOTICE 'ℹ️  Coluna encerrado_por já existe na tabela semestres';
  END IF;
END $$;

-- Adicionar encerrado_em (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'semestres' 
    AND column_name = 'encerrado_em'
  ) THEN
    ALTER TABLE "public"."semestres" ADD COLUMN "encerrado_em" TIMESTAMP(3);
    RAISE NOTICE '✅ Coluna encerrado_em adicionada à tabela semestres';
  ELSE
    RAISE NOTICE 'ℹ️  Coluna encerrado_em já existe na tabela semestres';
  END IF;
END $$;

-- Adicionar foreign key para ativado_por (se não existir)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_schema = 'public'
      AND constraint_name = 'semestres_ativado_por_fkey'
    ) THEN
      ALTER TABLE "public"."semestres" 
      ADD CONSTRAINT "semestres_ativado_por_fkey" 
      FOREIGN KEY ("ativado_por") 
      REFERENCES "public"."users"("id") 
      ON DELETE SET NULL ON UPDATE CASCADE;
      RAISE NOTICE '✅ Foreign key semestres_ativado_por_fkey adicionada';
    ELSE
      RAISE NOTICE 'ℹ️  Foreign key semestres_ativado_por_fkey já existe';
    END IF;
  ELSE
    RAISE NOTICE '⚠️  Tabela users não existe, pulando foreign key ativado_por';
  END IF;
END $$;

-- Adicionar foreign key para encerrado_por (se não existir)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_schema = 'public'
      AND constraint_name = 'semestres_encerrado_por_fkey'
    ) THEN
      ALTER TABLE "public"."semestres" 
      ADD CONSTRAINT "semestres_encerrado_por_fkey" 
      FOREIGN KEY ("encerrado_por") 
      REFERENCES "public"."users"("id") 
      ON DELETE SET NULL ON UPDATE CASCADE;
      RAISE NOTICE '✅ Foreign key semestres_encerrado_por_fkey adicionada';
    ELSE
      RAISE NOTICE 'ℹ️  Foreign key semestres_encerrado_por_fkey já existe';
    END IF;
  ELSE
    RAISE NOTICE '⚠️  Tabela users não existe, pulando foreign key encerrado_por';
  END IF;
END $$;

-- ============================================
-- TRIMESTRES
-- ============================================

-- Adicionar ativado_por (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'trimestres' 
    AND column_name = 'ativado_por'
  ) THEN
    ALTER TABLE "public"."trimestres" ADD COLUMN "ativado_por" TEXT;
    RAISE NOTICE '✅ Coluna ativado_por adicionada à tabela trimestres';
  ELSE
    RAISE NOTICE 'ℹ️  Coluna ativado_por já existe na tabela trimestres';
  END IF;
END $$;

-- Adicionar ativado_em (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'trimestres' 
    AND column_name = 'ativado_em'
  ) THEN
    ALTER TABLE "public"."trimestres" ADD COLUMN "ativado_em" TIMESTAMP(3);
    RAISE NOTICE '✅ Coluna ativado_em adicionada à tabela trimestres';
  ELSE
    RAISE NOTICE 'ℹ️  Coluna ativado_em já existe na tabela trimestres';
  END IF;
END $$;

-- Adicionar encerrado_por (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'trimestres' 
    AND column_name = 'encerrado_por'
  ) THEN
    ALTER TABLE "public"."trimestres" ADD COLUMN "encerrado_por" TEXT;
    RAISE NOTICE '✅ Coluna encerrado_por adicionada à tabela trimestres';
  ELSE
    RAISE NOTICE 'ℹ️  Coluna encerrado_por já existe na tabela trimestres';
  END IF;
END $$;

-- Adicionar encerrado_em (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'trimestres' 
    AND column_name = 'encerrado_em'
  ) THEN
    ALTER TABLE "public"."trimestres" ADD COLUMN "encerrado_em" TIMESTAMP(3);
    RAISE NOTICE '✅ Coluna encerrado_em adicionada à tabela trimestres';
  ELSE
    RAISE NOTICE 'ℹ️  Coluna encerrado_em já existe na tabela trimestres';
  END IF;
END $$;

-- Adicionar foreign key para ativado_por (se não existir)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_schema = 'public'
      AND constraint_name = 'trimestres_ativado_por_fkey'
    ) THEN
      ALTER TABLE "public"."trimestres" 
      ADD CONSTRAINT "trimestres_ativado_por_fkey" 
      FOREIGN KEY ("ativado_por") 
      REFERENCES "public"."users"("id") 
      ON DELETE SET NULL ON UPDATE CASCADE;
      RAISE NOTICE '✅ Foreign key trimestres_ativado_por_fkey adicionada';
    ELSE
      RAISE NOTICE 'ℹ️  Foreign key trimestres_ativado_por_fkey já existe';
    END IF;
  ELSE
    RAISE NOTICE '⚠️  Tabela users não existe, pulando foreign key ativado_por';
  END IF;
END $$;

-- Adicionar foreign key para encerrado_por (se não existir)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_schema = 'public'
      AND constraint_name = 'trimestres_encerrado_por_fkey'
    ) THEN
      ALTER TABLE "public"."trimestres" 
      ADD CONSTRAINT "trimestres_encerrado_por_fkey" 
      FOREIGN KEY ("encerrado_por") 
      REFERENCES "public"."users"("id") 
      ON DELETE SET NULL ON UPDATE CASCADE;
      RAISE NOTICE '✅ Foreign key trimestres_encerrado_por_fkey adicionada';
    ELSE
      RAISE NOTICE 'ℹ️  Foreign key trimestres_encerrado_por_fkey já existe';
    END IF;
  ELSE
    RAISE NOTICE '⚠️  Tabela users não existe, pulando foreign key encerrado_por';
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
  AND column_name IN ('ativado_por', 'ativado_em', 'encerrado_por', 'encerrado_em')
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
  AND column_name IN ('ativado_por', 'ativado_em', 'encerrado_por', 'encerrado_em')
ORDER BY column_name;

RAISE NOTICE '✅ Migração de campos de auditoria concluída!';

