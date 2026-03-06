-- CreateTable
CREATE TABLE "fechos_exercicio" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "lancamento_id" TEXT,
    "fechado_por" TEXT,
    "fechado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fechos_exercicio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fechos_exercicio_instituicao_id_ano_key" ON "fechos_exercicio"("instituicao_id", "ano");

-- CreateIndex
CREATE INDEX "fechos_exercicio_instituicao_id_idx" ON "fechos_exercicio"("instituicao_id");

-- AddForeignKey
ALTER TABLE "fechos_exercicio" ADD CONSTRAINT "fechos_exercicio_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
