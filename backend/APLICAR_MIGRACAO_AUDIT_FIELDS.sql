-- ============================================
-- MIGRAÇÃO URGENTE: Adicionar campos de auditoria
-- ============================================
-- Esta migração aplica os campos de auditoria que estão no schema Prisma
-- mas não existem no banco de dados, causando erro P2022
-- 
-- IMPORTANTE: Esta migração é idempotente (pode ser executada múltiplas vezes)
-- ============================================

-- ============================================
-- SEMESTRES
-- ============================================

-- Verificar e renomear iniciado_por para ativado_por (se existir)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public'
    AND constraint_name = 'semestres_iniciado_por_fkey'
  ) THEN
    ALTER TABLE "public"."semestres" DROP CONSTRAINT "semestres_iniciado_por_fkey";
    RAISE NOTICE '✅ Foreign key antiga semestres_iniciado_por_fkey removida';
  END IF;
END $$;

-- Renomear ou adicionar coluna ativado_por
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'semestres' 
    AND column_name = 'iniciado_por'
  ) THEN
    ALTER TABLE "public"."semestres" RENAME COLUMN "iniciado_por" TO "ativado_por";
    RAISE NOTICE '✅ Coluna iniciado_por renomeada para ativado_por em semestres';
  ELSIF NOT EXISTS (
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

-- Verificar e renomear iniciado_em para ativado_em (se existir)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'semestres' 
    AND column_name = 'iniciado_em'
  ) THEN
    ALTER TABLE "public"."semestres" RENAME COLUMN "iniciado_em" TO "ativado_em";
    RAISE NOTICE '✅ Coluna iniciado_em renomeada para ativado_em em semestres';
  ELSIF NOT EXISTS (
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
      RAISE NOTICE '✅ Foreign key ativado_por adicionada em semestres';
    ELSE
      RAISE NOTICE 'ℹ️  Foreign key ativado_por já existe em semestres';
    END IF;
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
      RAISE NOTICE '✅ Foreign key encerrado_por adicionada em semestres';
    ELSE
      RAISE NOTICE 'ℹ️  Foreign key encerrado_por já existe em semestres';
    END IF;
  END IF;
END $$;

-- ============================================
-- TRIMESTRES
-- ============================================

-- Adicionar ativado_por (se não existir e se tabela existir)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trimestres') THEN
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
  END IF;
END $$;

-- Adicionar ativado_em (se não existir e se tabela existir)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trimestres') THEN
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
  END IF;
END $$;

-- Adicionar encerrado_por (se não existir e se tabela existir)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trimestres') THEN
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
  END IF;
END $$;

-- Adicionar encerrado_em (se não existir e se tabela existir)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trimestres') THEN
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
  END IF;
END $$;

-- Adicionar foreign key para ativado_por em trimestres (se não existir)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trimestres')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
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
      RAISE NOTICE '✅ Foreign key ativado_por adicionada em trimestres';
    ELSE
      RAISE NOTICE 'ℹ️  Foreign key ativado_por já existe em trimestres';
    END IF;
  END IF;
END $$;

-- Adicionar foreign key para encerrado_por em trimestres (se não existir)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trimestres')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
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
      RAISE NOTICE '✅ Foreign key encerrado_por adicionada em trimestres';
    ELSE
      RAISE NOTICE 'ℹ️  Foreign key encerrado_por já existe em trimestres';
    END IF;
  END IF;
END $$;

-- ============================================
-- VALIDAÇÃO FINAL
-- ============================================

-- Verificar colunas em semestres
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VALIDAÇÃO: Campos de auditoria em semestres';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  - ativado_por: %', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'semestres' AND column_name = 'ativado_por') THEN '✅' ELSE '❌' END;
  RAISE NOTICE '  - ativado_em: %', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'semestres' AND column_name = 'ativado_em') THEN '✅' ELSE '❌' END;
  RAISE NOTICE '  - encerrado_por: %', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'semestres' AND column_name = 'encerrado_por') THEN '✅' ELSE '❌' END;
  RAISE NOTICE '  - encerrado_em: %', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'semestres' AND column_name = 'encerrado_em') THEN '✅' ELSE '❌' END;
END $$;

-- Verificar colunas em trimestres
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trimestres') THEN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VALIDAÇÃO: Campos de auditoria em trimestres';
    RAISE NOTICE '========================================';
    RAISE NOTICE '  - ativado_por: %', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trimestres' AND column_name = 'ativado_por') THEN '✅' ELSE '❌' END;
    RAISE NOTICE '  - ativado_em: %', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trimestres' AND column_name = 'ativado_em') THEN '✅' ELSE '❌' END;
    RAISE NOTICE '  - encerrado_por: %', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trimestres' AND column_name = 'encerrado_por') THEN '✅' ELSE '❌' END;
    RAISE NOTICE '  - encerrado_em: %', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trimestres' AND column_name = 'encerrado_em') THEN '✅' ELSE '❌' END;
  END IF;
END $$;

RAISE NOTICE '✅ Migração de campos de auditoria concluída!';

