-- CreateEnum
CREATE TYPE "TipoDocumentoFinanceiro" AS ENUM ('FT', 'RC', 'NC');

-- CreateEnum
CREATE TYPE "EstadoDocumentoFinanceiro" AS ENUM ('EMITIDO', 'ESTORNADO');

-- CreateTable
CREATE TABLE "documentos_financeiros" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "tipo_documento" "TipoDocumentoFinanceiro" NOT NULL,
    "numero_documento" TEXT NOT NULL,
    "data_documento" TIMESTAMP(3) NOT NULL,
    "entidade_id" TEXT NOT NULL,
    "valor_total" DECIMAL(12,2) NOT NULL,
    "valor_pago" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estado" "EstadoDocumentoFinanceiro" NOT NULL DEFAULT 'EMITIDO',
    "hash" TEXT,
    "hash_control" TEXT,
    "mensalidade_id" TEXT,
    "recibo_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_financeiros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documento_linhas" (
    "id" TEXT NOT NULL,
    "documento_id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "quantidade" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "preco_unitario" DECIMAL(12,2) NOT NULL,
    "valor_total" DECIMAL(12,2) NOT NULL,
    "taxa_iva" DECIMAL(5,2) NOT NULL DEFAULT 0,

    CONSTRAINT "documento_linhas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos_documento" (
    "id" TEXT NOT NULL,
    "documento_id" TEXT NOT NULL,
    "metodo_pagamento" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "data_pagamento" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pagamentos_documento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documentos_financeiros_instituicao_id_numero_documento_key" ON "documentos_financeiros"("instituicao_id", "numero_documento");

-- CreateIndex
CREATE UNIQUE INDEX "documentos_financeiros_recibo_id_key" ON "documentos_financeiros"("recibo_id");

-- CreateIndex
CREATE INDEX "documentos_financeiros_instituicao_id_idx" ON "documentos_financeiros"("instituicao_id");

-- CreateIndex
CREATE INDEX "documentos_financeiros_data_documento_idx" ON "documentos_financeiros"("data_documento");

-- CreateIndex
CREATE INDEX "documentos_financeiros_entidade_id_idx" ON "documentos_financeiros"("entidade_id");

-- CreateIndex
CREATE INDEX "documentos_financeiros_mensalidade_id_idx" ON "documentos_financeiros"("mensalidade_id");

-- CreateIndex
CREATE INDEX "documento_linhas_documento_id_idx" ON "documento_linhas"("documento_id");

-- CreateIndex
CREATE INDEX "pagamentos_documento_documento_id_idx" ON "pagamentos_documento"("documento_id");

-- CreateIndex
CREATE INDEX "saft_exports_instituicao_id_idx" ON "saft_exports"("instituicao_id");

-- AddForeignKey
ALTER TABLE "documentos_financeiros" ADD CONSTRAINT "documentos_financeiros_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_financeiros" ADD CONSTRAINT "documentos_financeiros_recibo_id_fkey" FOREIGN KEY ("recibo_id") REFERENCES "recibos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_linhas" ADD CONSTRAINT "documento_linhas_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "documentos_financeiros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos_documento" ADD CONSTRAINT "pagamentos_documento_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "documentos_financeiros"("id") ON DELETE CASCADE ON UPDATE CASCADE;
