-- ============================================
-- CRIAR TABELA TRIMESTRES
-- ============================================
-- Este script cria a tabela trimestres baseada no schema Prisma
-- Execute este script ANTES de fazer prisma db push
-- ============================================

-- Verificar se enum StatusSemestre existe, criar se não existir
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatusSemestre') THEN
    CREATE TYPE "StatusSemestre" AS ENUM ('PLANEJADO', 'ATIVO', 'ENCERRADO', 'CANCELADO');
    RAISE NOTICE '✅ Enum StatusSemestre criado';
  ELSE
    RAISE NOTICE 'ℹ️  Enum StatusSemestre já existe';
  END IF;
END $$;

-- Verificar se enum EstadoRegistro existe, criar se não existir
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoRegistro') THEN
    CREATE TYPE "EstadoRegistro" AS ENUM ('RASCUNHO', 'SUBMETIDO', 'APROVADO', 'REJEITADO', 'BLOQUEADO');
    RAISE NOTICE '✅ Enum EstadoRegistro criado';
  ELSE
    RAISE NOTICE 'ℹ️  Enum EstadoRegistro já existe';
  END IF;
END $$;

-- Criar tabela trimestres (se não existir)
CREATE TABLE IF NOT EXISTS "public"."trimestres" (
    "id" TEXT NOT NULL,
    "ano_letivo_id" TEXT NOT NULL,
    "ano_letivo" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "data_fim" TIMESTAMP(3),
    "data_inicio_notas" TIMESTAMP(3),
    "data_fim_notas" TIMESTAMP(3),
    "status" "StatusSemestre" NOT NULL DEFAULT 'PLANEJADO',
    "estado" "EstadoRegistro" NOT NULL DEFAULT 'RASCUNHO',
    "instituicao_id" TEXT,
    "ativado_por" TEXT,
    "ativado_em" TIMESTAMP(3),
    "encerrado_por" TEXT,
    "encerrado_em" TIMESTAMP(3),
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trimestres_pkey" PRIMARY KEY ("id")
);

-- Criar índices (se não existirem)
CREATE INDEX IF NOT EXISTS "trimestres_instituicao_id_idx" ON "public"."trimestres"("instituicao_id");
CREATE INDEX IF NOT EXISTS "trimestres_ano_letivo_idx" ON "public"."trimestres"("ano_letivo");
CREATE INDEX IF NOT EXISTS "trimestres_ano_letivo_id_idx" ON "public"."trimestres"("ano_letivo_id");
CREATE INDEX IF NOT EXISTS "trimestres_status_idx" ON "public"."trimestres"("status");
CREATE INDEX IF NOT EXISTS "trimestres_estado_idx" ON "public"."trimestres"("estado");
CREATE INDEX IF NOT EXISTS "trimestres_data_inicio_idx" ON "public"."trimestres"("data_inicio");

-- Criar unique constraint (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'trimestres_instituicao_id_ano_letivo_numero_key'
  ) THEN
    CREATE UNIQUE INDEX "trimestres_instituicao_id_ano_letivo_numero_key" 
      ON "public"."trimestres"("instituicao_id", "ano_letivo", "numero");
    RAISE NOTICE '✅ Unique constraint criada';
  ELSE
    RAISE NOTICE 'ℹ️  Unique constraint já existe';
  END IF;
END $$;

-- Adicionar foreign keys (se tabelas existirem)
DO $$
BEGIN
  -- FK para anos_letivos
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
      RAISE NOTICE '✅ Foreign key para anos_letivos criada';
    ELSE
      RAISE NOTICE 'ℹ️  Foreign key para anos_letivos já existe';
    END IF;
  ELSE
    RAISE NOTICE '⚠️  Tabela anos_letivos não existe, pulando FK';
  END IF;

  -- FK para instituicoes
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'instituicoes') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_schema = 'public'
      AND constraint_name = 'trimestres_instituicao_id_fkey'
    ) THEN
      ALTER TABLE "public"."trimestres" 
      ADD CONSTRAINT "trimestres_instituicao_id_fkey" 
      FOREIGN KEY ("instituicao_id") 
      REFERENCES "public"."instituicoes"("id") 
      ON DELETE SET NULL ON UPDATE CASCADE;
      RAISE NOTICE '✅ Foreign key para instituicoes criada';
    ELSE
      RAISE NOTICE 'ℹ️  Foreign key para instituicoes já existe';
    END IF;
  ELSE
    RAISE NOTICE '⚠️  Tabela instituicoes não existe, pulando FK';
  END IF;

  -- FK para users (ativado_por)
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
      RAISE NOTICE '✅ Foreign key para users (ativado_por) criada';
    ELSE
      RAISE NOTICE 'ℹ️  Foreign key para users (ativado_por) já existe';
    END IF;
  ELSE
    RAISE NOTICE '⚠️  Tabela users não existe, pulando FK ativado_por';
  END IF;

  -- FK para users (encerrado_por)
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
      RAISE NOTICE '✅ Foreign key para users (encerrado_por) criada';
    ELSE
      RAISE NOTICE 'ℹ️  Foreign key para users (encerrado_por) já existe';
    END IF;
  ELSE
    RAISE NOTICE '⚠️  Tabela users não existe, pulando FK encerrado_por';
  END IF;
END $$;

-- Verificar resultado
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trimestres') THEN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Tabela trimestres criada com sucesso!';
    RAISE NOTICE '========================================';
  ELSE
    RAISE NOTICE '========================================';
    RAISE NOTICE '❌ Erro ao criar tabela trimestres';
    RAISE NOTICE '========================================';
  END IF;
END $$;

