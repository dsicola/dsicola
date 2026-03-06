-- CreateTable
CREATE TABLE "configuracoes_contabilidade" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "conta_caixa_codigo" TEXT NOT NULL DEFAULT '11',
    "conta_banco_codigo" TEXT NOT NULL DEFAULT '12',
    "conta_receita_mensalidades_codigo" TEXT NOT NULL DEFAULT '41',
    "conta_receita_taxas_codigo" TEXT NOT NULL DEFAULT '42',
    "conta_pessoal_codigo" TEXT NOT NULL DEFAULT '51',
    "conta_fornecedores_codigo" TEXT NOT NULL DEFAULT '21',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracoes_contabilidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "centros_custo" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "centros_custo_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "lancamentos_contabeis_linhas" ADD COLUMN "centro_custo_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "configuracoes_contabilidade_instituicao_id_key" ON "configuracoes_contabilidade"("instituicao_id");

-- CreateIndex
CREATE UNIQUE INDEX "centros_custo_instituicao_id_codigo_key" ON "centros_custo"("instituicao_id", "codigo");

-- CreateIndex
CREATE INDEX "centros_custo_instituicao_id_idx" ON "centros_custo"("instituicao_id");

-- CreateIndex
CREATE INDEX "lancamentos_contabeis_linhas_centro_custo_id_idx" ON "lancamentos_contabeis_linhas"("centro_custo_id");

-- AddForeignKey
ALTER TABLE "configuracoes_contabilidade" ADD CONSTRAINT "configuracoes_contabilidade_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centros_custo" ADD CONSTRAINT "centros_custo_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_contabeis_linhas" ADD CONSTRAINT "lancamentos_contabeis_linhas_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
