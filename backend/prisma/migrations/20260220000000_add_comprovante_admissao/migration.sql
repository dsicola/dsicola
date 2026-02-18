-- CreateTable: Comprovante de Admissão - Numeração sequencial ADM-YYYY-NNNNNN por instituição
CREATE TABLE "comprovantes_admissao" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "funcionario_id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "emitido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emitido_por_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comprovantes_admissao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "comprovantes_admissao_instituicao_id_numero_key" ON "comprovantes_admissao"("instituicao_id", "numero");

-- CreateIndex
CREATE INDEX "comprovantes_admissao_instituicao_id_idx" ON "comprovantes_admissao"("instituicao_id");

-- CreateIndex
CREATE INDEX "comprovantes_admissao_funcionario_id_idx" ON "comprovantes_admissao"("funcionario_id");

-- AddForeignKey
ALTER TABLE "comprovantes_admissao" ADD CONSTRAINT "comprovantes_admissao_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprovantes_admissao" ADD CONSTRAINT "comprovantes_admissao_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "funcionarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
