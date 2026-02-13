-- ============================================
-- MIGRAÇÃO URGENTE: Adicionar ano_letivo_id
-- ============================================
-- Execute este script diretamente no banco de dados PostgreSQL
-- 
-- IMPORTANTE: Esta migração é idempotente (pode ser executada múltiplas vezes)
-- ============================================

-- Adicionar coluna ano_letivo_id em semestres (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'semestres' 
    AND column_name = 'ano_letivo_id'
  ) THEN
    ALTER TABLE "public"."semestres" ADD COLUMN "ano_letivo_id" TEXT;
    RAISE NOTICE '✅ Coluna ano_letivo_id adicionada à tabela semestres';
  ELSE
    RAISE NOTICE 'ℹ️  Coluna ano_letivo_id já existe na tabela semestres';
  END IF;
END $$;

-- Adicionar coluna ano_letivo_id em trimestres (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'trimestres' 
    AND column_name = 'ano_letivo_id'
  ) THEN
    ALTER TABLE "public"."trimestres" ADD COLUMN "ano_letivo_id" TEXT;
    RAISE NOTICE '✅ Coluna ano_letivo_id adicionada à tabela trimestres';
  ELSE
    RAISE NOTICE 'ℹ️  Coluna ano_letivo_id já existe na tabela trimestres';
  END IF;
END $$;

-- Criar índices (se não existirem)
CREATE INDEX IF NOT EXISTS "semestres_ano_letivo_id_idx" ON "public"."semestres"("ano_letivo_id");
CREATE INDEX IF NOT EXISTS "trimestres_ano_letivo_id_idx" ON "public"."trimestres"("ano_letivo_id");

-- Adicionar foreign key em semestres (se não existir)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'anos_letivos') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_schema = 'public'
      AND constraint_name = 'semestres_ano_letivo_id_fkey'
    ) THEN
      ALTER TABLE "public"."semestres" 
      ADD CONSTRAINT "semestres_ano_letivo_id_fkey" 
      FOREIGN KEY ("ano_letivo_id") 
      REFERENCES "public"."anos_letivos"("id") 
      ON DELETE CASCADE ON UPDATE CASCADE;
      RAISE NOTICE '✅ Foreign key adicionada em semestres';
    ELSE
      RAISE NOTICE 'ℹ️  Foreign key já existe em semestres';
    END IF;
  ELSE
    RAISE NOTICE '⚠️  Tabela anos_letivos não existe, pulando foreign key em semestres';
  END IF;
END $$;

-- Adicionar foreign key em trimestres (se não existir)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'anos_letivos') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_schema = 'public'
      AND constraint_name = 'trimestres_ano_letivo_id_fkey'
    ) THEN
      ALTER TABLE "public"."trimestres" 
      ADD CONSTRAINT "trimestres_ano_letivo_id_fkey" 
      FOREIGN KEY ("ano_letivo_id") 
      REFERENCES "public"."anos_letivos"("id") 
      ON DELETE CASCADE ON UPDATE CASCADE;
      RAISE NOTICE '✅ Foreign key adicionada em trimestres';
    ELSE
      RAISE NOTICE 'ℹ️  Foreign key já existe em trimestres';
    END IF;
  ELSE
    RAISE NOTICE '⚠️  Tabela anos_letivos não existe, pulando foreign key em trimestres';
  END IF;
END $$;

-- Preencher ano_letivo_id com base no ano_letivo existente (apenas se tabela anos_letivos existir)
DO $$
DECLARE
  semestres_atualizados INTEGER;
  trimestres_atualizados INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'anos_letivos') THEN
    UPDATE "public"."semestres" s
    SET "ano_letivo_id" = al.id
    FROM "public"."anos_letivos" al
    WHERE s."ano_letivo" = al."ano" 
      AND (
        (s."instituicao_id" = al."instituicao_id") 
        OR (s."instituicao_id" IS NULL AND al."instituicao_id" IS NULL)
      )
      AND s."ano_letivo_id" IS NULL;
    
    GET DIAGNOSTICS semestres_atualizados = ROW_COUNT;
    RAISE NOTICE '✅ % semestre(s) atualizado(s) com ano_letivo_id', semestres_atualizados;
    
    UPDATE "public"."trimestres" t
    SET "ano_letivo_id" = al.id
    FROM "public"."anos_letivos" al
    WHERE t."ano_letivo" = al."ano" 
      AND (
        (t."instituicao_id" = al."instituicao_id") 
        OR (t."instituicao_id" IS NULL AND al."instituicao_id" IS NULL)
      )
      AND t."ano_letivo_id" IS NULL;
    
    GET DIAGNOSTICS trimestres_atualizados = ROW_COUNT;
    RAISE NOTICE '✅ % trimestre(s) atualizado(s) com ano_letivo_id', trimestres_atualizados;
  ELSE
    RAISE NOTICE '⚠️  Tabela anos_letivos não existe, pulando preenchimento de ano_letivo_id';
  END IF;
END $$;

-- Verificar resultado
SELECT 
  'semestres' as tabela,
  COUNT(*) as total,
  COUNT("ano_letivo_id") as com_ano_letivo_id,
  COUNT(*) - COUNT("ano_letivo_id") as sem_ano_letivo_id
FROM "public"."semestres"
UNION ALL
SELECT 
  'trimestres' as tabela,
  COUNT(*) as total,
  COUNT("ano_letivo_id") as com_ano_letivo_id,
  COUNT(*) - COUNT("ano_letivo_id") as sem_ano_letivo_id
FROM "public"."trimestres";
