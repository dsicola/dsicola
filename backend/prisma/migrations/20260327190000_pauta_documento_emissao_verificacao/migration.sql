-- Pautas impressas: registo por emissão com código persistente e hash SHA-256 para consulta pública.

CREATE TABLE "pauta_documento_emissoes" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "plano_ensino_id" TEXT NOT NULL,
    "tipo_pauta" TEXT NOT NULL,
    "codigo_verificacao" TEXT NOT NULL,
    "hash_sha256" TEXT NOT NULL,
    "emitido_por_user_id" TEXT NOT NULL,
    "instituicao_nome_snapshot" TEXT,
    "ano_letivo_label" TEXT,
    "label_curso_classe" TEXT,
    "valor_curso_classe" TEXT,
    "turma_nome" TEXT,
    "disciplina_nome" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pauta_documento_emissoes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pauta_documento_emissoes_codigo_verificacao_key" ON "pauta_documento_emissoes"("codigo_verificacao");
CREATE INDEX "pauta_documento_emissoes_instituicao_id_idx" ON "pauta_documento_emissoes"("instituicao_id");
CREATE INDEX "pauta_documento_emissoes_plano_ensino_id_idx" ON "pauta_documento_emissoes"("plano_ensino_id");

ALTER TABLE "pauta_documento_emissoes" ADD CONSTRAINT "pauta_documento_emissoes_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pauta_documento_emissoes" ADD CONSTRAINT "pauta_documento_emissoes_plano_ensino_id_fkey" FOREIGN KEY ("plano_ensino_id") REFERENCES "plano_ensino"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pauta_documento_emissoes" ADD CONSTRAINT "pauta_documento_emissoes_emitido_por_user_id_fkey" FOREIGN KEY ("emitido_por_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
