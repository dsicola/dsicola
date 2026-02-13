-- ============================================
-- MIGRAÇÃO URGENTE: Adicionar campos de encerramento acadêmico em semestres
-- ============================================
-- Execute este script diretamente no banco de dados PostgreSQL
-- 
-- IMPORTANTE: Esta migração é idempotente (pode ser executada múltiplas vezes)
-- ============================================

-- Verificar e adicionar encerramento_ativado_id (se não existir)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'semestres') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'semestres' 
      AND column_name = 'encerramento_ativado_id'
    ) THEN
      ALTER TABLE "public"."semestres" 
      ADD COLUMN "encerramento_ativado_id" TEXT;
      
      RAISE NOTICE '✅ Coluna encerramento_ativado_id adicionada à tabela semestres';
    ELSE
      RAISE NOTICE 'ℹ️  Coluna encerramento_ativado_id já existe na tabela semestres';
    END IF;
  ELSE
    RAISE NOTICE '⚠️  Tabela semestres não existe ainda';
  END IF;
END $$;

-- Verificar e adicionar encerramento_encerrado_id (se não existir)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'semestres') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'semestres' 
      AND column_name = 'encerramento_encerrado_id'
    ) THEN
      ALTER TABLE "public"."semestres" 
      ADD COLUMN "encerramento_encerrado_id" TEXT;
      
      RAISE NOTICE '✅ Coluna encerramento_encerrado_id adicionada à tabela semestres';
    ELSE
      RAISE NOTICE 'ℹ️  Coluna encerramento_encerrado_id já existe na tabela semestres';
    END IF;
  ELSE
    RAISE NOTICE '⚠️  Tabela semestres não existe ainda';
  END IF;
END $$;

-- Adicionar foreign keys (se a tabela encerramentos_academicos existir)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'encerramentos_academicos') THEN
    -- Foreign key para encerramento_ativado_id
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_schema = 'public'
      AND constraint_name = 'semestres_encerramento_ativado_id_fkey'
    ) THEN
      ALTER TABLE "public"."semestres" 
      ADD CONSTRAINT "semestres_encerramento_ativado_id_fkey" 
      FOREIGN KEY ("encerramento_ativado_id") 
      REFERENCES "public"."encerramentos_academicos"("id") 
      ON DELETE SET NULL ON UPDATE CASCADE;
      
      RAISE NOTICE '✅ Foreign key semestres_encerramento_ativado_id_fkey adicionada';
    ELSE
      RAISE NOTICE 'ℹ️  Foreign key semestres_encerramento_ativado_id_fkey já existe';
    END IF;
    
    -- Foreign key para encerramento_encerrado_id
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_schema = 'public'
      AND constraint_name = 'semestres_encerramento_encerrado_id_fkey'
    ) THEN
      ALTER TABLE "public"."semestres" 
      ADD CONSTRAINT "semestres_encerramento_encerrado_id_fkey" 
      FOREIGN KEY ("encerramento_encerrado_id") 
      REFERENCES "public"."encerramentos_academicos"("id") 
      ON DELETE SET NULL ON UPDATE CASCADE;
      
      RAISE NOTICE '✅ Foreign key semestres_encerramento_encerrado_id_fkey adicionada';
    ELSE
      RAISE NOTICE 'ℹ️  Foreign key semestres_encerramento_encerrado_id_fkey já existe';
    END IF;
  ELSE
    RAISE NOTICE '⚠️  Tabela encerramentos_academicos não existe, pulando foreign keys';
  END IF;
END $$;

-- Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS "semestres_encerramento_ativado_id_idx" ON "public"."semestres"("encerramento_ativado_id");
CREATE INDEX IF NOT EXISTS "semestres_encerramento_encerrado_id_idx" ON "public"."semestres"("encerramento_encerrado_id");

-- Verificar resultado
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICAÇÃO FINAL - SEMESTRES';
  RAISE NOTICE '========================================';
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'semestres' AND column_name = 'encerramento_ativado_id'
  ) THEN
    RAISE NOTICE '✅ semestres.encerramento_ativado_id: EXISTE';
  ELSE
    RAISE NOTICE '❌ semestres.encerramento_ativado_id: NÃO EXISTE';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'semestres' AND column_name = 'encerramento_encerrado_id'
  ) THEN
    RAISE NOTICE '✅ semestres.encerramento_encerrado_id: EXISTE';
  ELSE
    RAISE NOTICE '❌ semestres.encerramento_encerrado_id: NÃO EXISTE';
  END IF;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migração concluída!';
  RAISE NOTICE '========================================';
END $$;

