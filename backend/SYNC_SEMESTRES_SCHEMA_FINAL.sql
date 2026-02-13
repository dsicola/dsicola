-- ============================================
-- MIGRAÇÃO DEFINITIVA: Sincronização Total da Tabela semestres
-- ============================================
-- Data: 2025-01-27
-- Objetivo: Alinhar COMPLETAMENTE a tabela semestres com o schema.prisma
-- 
-- IMPORTANTE: Esta migration é idempotente e NÃO remove dados existentes
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'INICIANDO SINCRONIZAÇÃO: semestres';
  RAISE NOTICE '========================================';
END $$;

-- ============================================
-- 1. ano_letivo_id (FK para anos_letivos)
-- ============================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'semestres' 
    AND column_name = 'ano_letivo_id'
  ) THEN
    ALTER TABLE "public"."semestres" ADD COLUMN "ano_letivo_id" TEXT;
    RAISE NOTICE '✅ Coluna ano_letivo_id adicionada';
  ELSE
    RAISE NOTICE 'ℹ️  Coluna ano_letivo_id já existe';
  END IF;
END $$;

-- ============================================
-- 2. data_inicio_notas
-- ============================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'semestres' 
    AND column_name = 'data_inicio_notas'
  ) THEN
    ALTER TABLE "public"."semestres" ADD COLUMN "data_inicio_notas" TIMESTAMP(3);
    RAISE NOTICE '✅ Coluna data_inicio_notas adicionada';
  ELSE
    RAISE NOTICE 'ℹ️  Coluna data_inicio_notas já existe';
  END IF;
END $$;

-- ============================================
-- 3. data_fim_notas
-- ============================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'semestres' 
    AND column_name = 'data_fim_notas'
  ) THEN
    ALTER TABLE "public"."semestres" ADD COLUMN "data_fim_notas" TIMESTAMP(3);
    RAISE NOTICE '✅ Coluna data_fim_notas adicionada';
  ELSE
    RAISE NOTICE 'ℹ️  Coluna data_fim_notas já existe';
  END IF;
END $$;

-- ============================================
-- 4. estado (EstadoRegistro enum)
-- ============================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'semestres' 
    AND column_name = 'estado'
  ) THEN
    -- Verificar se o tipo enum existe
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoRegistro') THEN
      CREATE TYPE "EstadoRegistro" AS ENUM ('RASCUNHO', 'SUBMETIDO', 'APROVADO', 'REJEITADO', 'BLOQUEADO');
    END IF;
    ALTER TABLE "public"."semestres" ADD COLUMN "estado" "EstadoRegistro" DEFAULT 'RASCUNHO';
    RAISE NOTICE '✅ Coluna estado adicionada';
  ELSE
    RAISE NOTICE 'ℹ️  Coluna estado já existe';
  END IF;
END $$;

-- ============================================
-- 5. encerramento_ativado_id
-- ============================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'semestres' 
    AND column_name = 'encerramento_ativado_id'
  ) THEN
    ALTER TABLE "public"."semestres" ADD COLUMN "encerramento_ativado_id" TEXT;
    RAISE NOTICE '✅ Coluna encerramento_ativado_id adicionada';
  ELSE
    RAISE NOTICE 'ℹ️  Coluna encerramento_ativado_id já existe';
  END IF;
END $$;

-- ============================================
-- 6. encerramento_encerrado_id
-- ============================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'semestres' 
    AND column_name = 'encerramento_encerrado_id'
  ) THEN
    ALTER TABLE "public"."semestres" ADD COLUMN "encerramento_encerrado_id" TEXT;
    RAISE NOTICE '✅ Coluna encerramento_encerrado_id adicionada';
  ELSE
    RAISE NOTICE 'ℹ️  Coluna encerramento_encerrado_id já existe';
  END IF;
END $$;

-- ============================================
-- 7. Criar índices (se não existirem)
-- ============================================
CREATE INDEX IF NOT EXISTS "semestres_ano_letivo_id_idx" ON "public"."semestres"("ano_letivo_id");
CREATE INDEX IF NOT EXISTS "semestres_instituicao_id_idx" ON "public"."semestres"("instituicao_id");
CREATE INDEX IF NOT EXISTS "semestres_ano_letivo_idx" ON "public"."semestres"("ano_letivo");
CREATE INDEX IF NOT EXISTS "semestres_status_idx" ON "public"."semestres"("status");
CREATE INDEX IF NOT EXISTS "semestres_estado_idx" ON "public"."semestres"("estado");
CREATE INDEX IF NOT EXISTS "semestres_data_inicio_idx" ON "public"."semestres"("data_inicio");

-- ============================================
-- 8. Adicionar Foreign Keys (se não existirem)
-- ============================================

-- FK: ano_letivo_id -> anos_letivos.id
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
      RAISE NOTICE '✅ Foreign key semestres_ano_letivo_id_fkey adicionada';
    ELSE
      RAISE NOTICE 'ℹ️  Foreign key semestres_ano_letivo_id_fkey já existe';
    END IF;
  ELSE
    RAISE NOTICE '⚠️  Tabela anos_letivos não existe, pulando FK';
  END IF;
END $$;

-- FK: encerramento_ativado_id -> encerramentos_academicos.id
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'encerramentos_academicos') THEN
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
  ELSE
    RAISE NOTICE '⚠️  Tabela encerramentos_academicos não existe, pulando FK';
  END IF;
END $$;

-- FK: encerramento_encerrado_id -> encerramentos_academicos.id
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'encerramentos_academicos') THEN
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
    RAISE NOTICE '⚠️  Tabela encerramentos_academicos não existe, pulando FK';
  END IF;
END $$;

-- ============================================
-- 9. Verificação Final
-- ============================================
DO $$
DECLARE
  colunas_esperadas TEXT[] := ARRAY[
    'id', 'ano_letivo_id', 'ano_letivo', 'numero', 'data_inicio', 'data_fim',
    'data_inicio_notas', 'data_fim_notas', 'status', 'estado', 'instituicao_id',
    'ativado_por', 'ativado_em', 'encerrado_por', 'encerrado_em',
    'encerramento_ativado_id', 'encerramento_encerrado_id', 'observacoes',
    'created_at', 'updated_at'
  ];
  coluna TEXT;
  existe BOOLEAN;
  faltantes TEXT[] := ARRAY[]::TEXT[];
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICAÇÃO FINAL DE COLUNAS';
  RAISE NOTICE '========================================';
  
  FOREACH coluna IN ARRAY colunas_esperadas
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'semestres' 
      AND column_name = coluna
    ) INTO existe;
    
    IF existe THEN
      RAISE NOTICE '✅ %: EXISTE', coluna;
    ELSE
      RAISE NOTICE '❌ %: NÃO EXISTE', coluna;
      faltantes := array_append(faltantes, coluna);
    END IF;
  END LOOP;
  
  RAISE NOTICE '========================================';
  IF array_length(faltantes, 1) IS NULL THEN
    RAISE NOTICE '✅ TODAS AS COLUNAS ESTÃO PRESENTES!';
  ELSE
    RAISE NOTICE '⚠️  COLUNAS FALTANTES: %', array_to_string(faltantes, ', ');
  END IF;
  RAISE NOTICE '========================================';
END $$;
