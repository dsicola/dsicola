-- Plano de Ensino: Controle de versão e histórico (padrão SIGAE)
-- Adiciona versao, planoEnsinoIdAnterior e tabela de histórico para auditoria

-- 1. Adicionar colunas de versão ao plano_ensino
ALTER TABLE "plano_ensino" ADD COLUMN IF NOT EXISTS "versao" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "plano_ensino" ADD COLUMN IF NOT EXISTS "plano_ensino_id_anterior" VARCHAR;

-- 2. Criar tabela de histórico (snapshot ao aprovar)
CREATE TABLE IF NOT EXISTS "plano_ensino_historico" (
  "id" VARCHAR NOT NULL,
  "plano_ensino_id" VARCHAR NOT NULL,
  "versao" INTEGER NOT NULL,
  "data_alteracao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status_anterior" VARCHAR,
  "status_novo" VARCHAR NOT NULL,
  "snapshot" JSONB,
  "usuario_id" VARCHAR,
  "instituicao_id" VARCHAR NOT NULL,

  CONSTRAINT "plano_ensino_historico_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "plano_ensino_historico_plano_ensino_id_idx" ON "plano_ensino_historico"("plano_ensino_id");
CREATE INDEX IF NOT EXISTS "plano_ensino_historico_instituicao_id_idx" ON "plano_ensino_historico"("instituicao_id");
