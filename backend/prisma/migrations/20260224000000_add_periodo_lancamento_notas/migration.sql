-- CreateEnum
CREATE TYPE "StatusPeriodoLancamentoNotas" AS ENUM ('ABERTO', 'FECHADO', 'EXPIRADO');

-- CreateTable
CREATE TABLE "periodos_lancamento_notas" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "ano_letivo_id" TEXT NOT NULL,
    "tipo_periodo" TEXT NOT NULL,
    "numero_periodo" INTEGER NOT NULL,
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "data_fim" TIMESTAMP(3) NOT NULL,
    "status" "StatusPeriodoLancamentoNotas" NOT NULL DEFAULT 'ABERTO',
    "reaberto_por" TEXT,
    "reaberto_em" TIMESTAMP(3),
    "motivo_reabertura" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "periodos_lancamento_notas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "periodos_lancamento_notas_instituicao_ano_tipo_numero_key" ON "periodos_lancamento_notas"("instituicao_id", "ano_letivo_id", "tipo_periodo", "numero_periodo");

-- CreateIndex
CREATE INDEX "periodos_lancamento_notas_instituicao_id_idx" ON "periodos_lancamento_notas"("instituicao_id");

-- CreateIndex
CREATE INDEX "periodos_lancamento_notas_ano_letivo_id_idx" ON "periodos_lancamento_notas"("ano_letivo_id");

-- CreateIndex
CREATE INDEX "periodos_lancamento_notas_data_inicio_data_fim_idx" ON "periodos_lancamento_notas"("data_inicio", "data_fim");

-- AddForeignKey
ALTER TABLE "periodos_lancamento_notas" ADD CONSTRAINT "periodos_lancamento_notas_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodos_lancamento_notas" ADD CONSTRAINT "periodos_lancamento_notas_ano_letivo_id_fkey" FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodos_lancamento_notas" ADD CONSTRAINT "periodos_lancamento_notas_reaberto_por_fkey" FOREIGN KEY ("reaberto_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
