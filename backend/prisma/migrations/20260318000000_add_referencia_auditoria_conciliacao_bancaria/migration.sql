-- AlterTable
ALTER TABLE "lancamentos_contabeis" ADD COLUMN "referencia_externa" TEXT;
ALTER TABLE "lancamentos_contabeis" ADD COLUMN "referencia_tipo" TEXT;
ALTER TABLE "lancamentos_contabeis" ADD COLUMN "criado_por" TEXT;
ALTER TABLE "lancamentos_contabeis" ADD COLUMN "alterado_por" TEXT;

-- CreateIndex
CREATE INDEX "lancamentos_contabeis_referencia_externa_idx" ON "lancamentos_contabeis"("referencia_externa");

-- AddForeignKey
ALTER TABLE "lancamentos_contabeis" ADD CONSTRAINT "lancamentos_contabeis_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lancamentos_contabeis" ADD CONSTRAINT "lancamentos_contabeis_alterado_por_fkey" FOREIGN KEY ("alterado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "contas_bancarias" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "iban_ou_numero" TEXT,
    "banco" TEXT,
    "conta_contabil_id" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contas_bancarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentos_extrato_bancario" (
    "id" TEXT NOT NULL,
    "conta_bancaria_id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "descricao" TEXT,
    "referencia_externa" TEXT,
    "conciliado" BOOLEAN NOT NULL DEFAULT false,
    "lancamento_contabil_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentos_extrato_bancario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contas_bancarias_instituicao_id_idx" ON "contas_bancarias"("instituicao_id");

-- CreateIndex
CREATE INDEX "movimentos_extrato_bancario_conta_bancaria_id_idx" ON "movimentos_extrato_bancario"("conta_bancaria_id");
CREATE INDEX "movimentos_extrato_bancario_instituicao_id_idx" ON "movimentos_extrato_bancario"("instituicao_id");
CREATE INDEX "movimentos_extrato_bancario_data_idx" ON "movimentos_extrato_bancario"("data");
CREATE INDEX "movimentos_extrato_bancario_conciliado_idx" ON "movimentos_extrato_bancario"("conciliado");

-- AddForeignKey
ALTER TABLE "contas_bancarias" ADD CONSTRAINT "contas_bancarias_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contas_bancarias" ADD CONSTRAINT "contas_bancarias_conta_contabil_id_fkey" FOREIGN KEY ("conta_contabil_id") REFERENCES "plano_contas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentos_extrato_bancario" ADD CONSTRAINT "movimentos_extrato_bancario_conta_bancaria_id_fkey" FOREIGN KEY ("conta_bancaria_id") REFERENCES "contas_bancarias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "movimentos_extrato_bancario" ADD CONSTRAINT "movimentos_extrato_bancario_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "movimentos_extrato_bancario" ADD CONSTRAINT "movimentos_extrato_bancario_lancamento_contabil_id_fkey" FOREIGN KEY ("lancamento_contabil_id") REFERENCES "lancamentos_contabeis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
