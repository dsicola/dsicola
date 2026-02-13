-- ============================================
-- MIGRATION: Criar tabelas anos_letivos e semestres
-- Data: 2025-01-20
-- Descrição: Criação inicial das tabelas acadêmicas
-- ============================================

-- Criar enums necessários (idempotente, um por bloco)
-- StatusAnoLetivo
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatusAnoLetivo') THEN
    CREATE TYPE "StatusAnoLetivo" AS ENUM ('PLANEJADO', 'ATIVO', 'ENCERRADO');
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- StatusSemestre
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatusSemestre') THEN
    CREATE TYPE "StatusSemestre" AS ENUM ('PLANEJADO', 'ATIVO', 'ENCERRADO', 'CANCELADO');
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- EstadoRegistro
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoRegistro') THEN
    CREATE TYPE "EstadoRegistro" AS ENUM ('RASCUNHO', 'EM_REVISAO', 'APROVADO', 'ENCERRADO');
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Criar tabela anos_letivos PRIMEIRO (requisito para semestres)
CREATE TABLE IF NOT EXISTS "anos_letivos" (
    "id" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "data_fim" TIMESTAMP(3),
    "status" "StatusAnoLetivo" NOT NULL DEFAULT 'PLANEJADO',
    "instituicao_id" TEXT,
    "ativado_por" TEXT,
    "ativado_em" TIMESTAMP(3),
    "encerrado_por" TEXT,
    "encerrado_em" TIMESTAMP(3),
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "anos_letivos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "anos_letivos_instituicao_id_idx" ON "anos_letivos"("instituicao_id");
CREATE INDEX IF NOT EXISTS "anos_letivos_ano_idx" ON "anos_letivos"("ano");
CREATE INDEX IF NOT EXISTS "anos_letivos_status_idx" ON "anos_letivos"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "anos_letivos_instituicao_id_ano_key" ON "anos_letivos"("instituicao_id", "ano");

-- Criar tabela semestres DEPOIS de anos_letivos
-- Nota: ano_letivo_id é criado como nullable inicialmente
-- Será tornado NOT NULL pela migration 20260130000000 após preenchimento dos dados
CREATE TABLE IF NOT EXISTS "semestres" (
    "id" TEXT NOT NULL,
    "ano_letivo_id" TEXT,
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
    "encerramento_ativado_id" TEXT,
    "encerramento_encerrado_id" TEXT,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "semestres_pkey" PRIMARY KEY ("id")
);

-- Criar índices para semestres
CREATE INDEX IF NOT EXISTS "semestres_instituicao_id_idx" ON "semestres"("instituicao_id");
CREATE INDEX IF NOT EXISTS "semestres_ano_letivo_idx" ON "semestres"("ano_letivo");
CREATE INDEX IF NOT EXISTS "semestres_ano_letivo_id_idx" ON "semestres"("ano_letivo_id");
CREATE INDEX IF NOT EXISTS "semestres_status_idx" ON "semestres"("status");
CREATE INDEX IF NOT EXISTS "semestres_estado_idx" ON "semestres"("estado");
CREATE INDEX IF NOT EXISTS "semestres_data_inicio_idx" ON "semestres"("data_inicio");

-- Unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "semestres_instituicao_id_ano_letivo_numero_key" 
ON "semestres"("instituicao_id", "ano_letivo", "numero");

-- Adicionar foreign keys quando as tabelas referenciadas existirem
DO $$
BEGIN
  -- FK: semestres.ano_letivo_id -> anos_letivos.id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'anos_letivos') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_schema = 'public' AND constraint_name = 'semestres_ano_letivo_id_fkey'
    ) THEN
      ALTER TABLE "semestres" ADD CONSTRAINT "semestres_ano_letivo_id_fkey" 
        FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;

  -- FK: semestres.instituicao_id -> instituicoes.id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'instituicoes') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_schema = 'public' AND constraint_name = 'semestres_instituicao_id_fkey'
    ) THEN
      ALTER TABLE "semestres" ADD CONSTRAINT "semestres_instituicao_id_fkey" 
        FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;
