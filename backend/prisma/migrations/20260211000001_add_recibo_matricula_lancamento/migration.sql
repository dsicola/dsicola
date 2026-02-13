-- CreateEnum
CREATE TYPE "StatusRecibo" AS ENUM ('EMITIDO', 'ESTORNADO');

-- AlterTable: add matricula_id to mensalidades
ALTER TABLE "mensalidades" ADD COLUMN IF NOT EXISTS "matricula_id" TEXT;

-- CreateTable: recibos
CREATE TABLE "recibos" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "mensalidade_id" TEXT NOT NULL,
    "pagamento_id" TEXT NOT NULL,
    "matricula_id" TEXT,
    "numero_recibo" TEXT NOT NULL,
    "status" "StatusRecibo" NOT NULL DEFAULT 'EMITIDO',
    "valor" DECIMAL(10,2) NOT NULL,
    "data_emissao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recibos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recibos_pagamento_id_key" ON "recibos"("pagamento_id");

-- CreateIndex
CREATE UNIQUE INDEX "recibos_instituicao_id_numero_recibo_key" ON "recibos"("instituicao_id", "numero_recibo");

-- CreateIndex
CREATE INDEX "recibos_instituicao_id_idx" ON "recibos"("instituicao_id");

-- CreateIndex
CREATE INDEX "recibos_mensalidade_id_idx" ON "recibos"("mensalidade_id");

-- CreateIndex
CREATE INDEX "recibos_matricula_id_idx" ON "recibos"("matricula_id");

-- CreateIndex
CREATE INDEX "mensalidades_matricula_id_idx" ON "mensalidades"("matricula_id");

-- AddForeignKey: Recibo -> Instituicao
ALTER TABLE "recibos" ADD CONSTRAINT "recibos_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Recibo -> Mensalidade
ALTER TABLE "recibos" ADD CONSTRAINT "recibos_mensalidade_id_fkey" FOREIGN KEY ("mensalidade_id") REFERENCES "mensalidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Recibo -> Pagamento
ALTER TABLE "recibos" ADD CONSTRAINT "recibos_pagamento_id_fkey" FOREIGN KEY ("pagamento_id") REFERENCES "pagamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Recibo -> Matricula (optional)
ALTER TABLE "recibos" ADD CONSTRAINT "recibos_matricula_id_fkey" FOREIGN KEY ("matricula_id") REFERENCES "matriculas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Mensalidade -> Matricula (optional)
ALTER TABLE "mensalidades" ADD CONSTRAINT "mensalidades_matricula_id_fkey" FOREIGN KEY ("matricula_id") REFERENCES "matriculas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
