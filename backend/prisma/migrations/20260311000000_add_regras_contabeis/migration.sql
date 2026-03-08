-- CreateTable
CREATE TABLE "regras_contabeis" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "evento" TEXT NOT NULL,
    "conta_debito_codigo" TEXT NOT NULL,
    "conta_credito_codigo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regras_contabeis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "regras_contabeis_instituicao_id_evento_key" ON "regras_contabeis"("instituicao_id", "evento");

-- CreateIndex
CREATE INDEX "regras_contabeis_instituicao_id_idx" ON "regras_contabeis"("instituicao_id");

-- AddForeignKey
ALTER TABLE "regras_contabeis" ADD CONSTRAINT "regras_contabeis_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
