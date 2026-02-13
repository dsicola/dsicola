-- CreateEnum
CREATE TYPE "TipoServicoFornecedor" AS ENUM ('SEGURANCA', 'LIMPEZA', 'TI', 'CANTINA', 'MANUTENCAO', 'OUTRO');

-- CreateEnum
CREATE TYPE "StatusFornecedor" AS ENUM ('ATIVO', 'INATIVO', 'SUSPENSO');

-- CreateEnum
CREATE TYPE "TipoContratoFornecedor" AS ENUM ('MENSAL', 'ANUAL', 'EVENTUAL');

-- CreateEnum
CREATE TYPE "StatusContratoFornecedor" AS ENUM ('ATIVO', 'ENCERRADO', 'SUSPENSO');

-- CreateEnum
CREATE TYPE "StatusPagamentoFornecedor" AS ENUM ('PENDENTE', 'PAGO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "MetodoPagamentoFornecedor" AS ENUM ('TRANSFERENCIA', 'CASH', 'CHEQUE', 'MOBILE_MONEY', 'OUTRO');

-- AlterTable
ALTER TABLE "backup_history" ADD COLUMN     "algoritmo" TEXT,
ADD COLUMN     "algoritmo_assinatura" TEXT,
ADD COLUMN     "assinatura_digital" TEXT,
ADD COLUMN     "assinatura_verificada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "chave_id" TEXT,
ADD COLUMN     "criptografado" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "expirado_em" TIMESTAMP(3),
ADD COLUMN     "hash_sha256" TEXT,
ADD COLUMN     "hash_verificado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "iv" TEXT,
ADD COLUMN     "status_retencao" TEXT DEFAULT 'ativo',
ADD COLUMN     "tag_autenticacao" TEXT;

-- CreateTable
CREATE TABLE "termos_responsabilidade" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "instituicao_id" TEXT,
    "operacao" TEXT NOT NULL,
    "confirmado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "palavra_chave" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "termos_responsabilidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "termos_legais" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "tipo_acao" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "conteudo_html" TEXT NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "termos_legais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aceites_termos_legais" (
    "id" TEXT NOT NULL,
    "termo_id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "hash_pdf" TEXT,
    "caminho_pdf" TEXT,
    "aceito_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aceites_termos_legais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fornecedores" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "razao_social" TEXT NOT NULL,
    "nif" TEXT,
    "tipo_servico" "TipoServicoFornecedor" NOT NULL,
    "contato" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "endereco" TEXT,
    "cidade" TEXT,
    "pais" TEXT DEFAULT 'Angola',
    "status" "StatusFornecedor" NOT NULL DEFAULT 'ATIVO',
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fornecedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contratos_fornecedor" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "fornecedor_id" TEXT NOT NULL,
    "tipo_contrato" "TipoContratoFornecedor" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "data_fim" TIMESTAMP(3),
    "status" "StatusContratoFornecedor" NOT NULL DEFAULT 'ATIVO',
    "observacoes" TEXT,
    "criado_por" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contratos_fornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos_fornecedor" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "fornecedor_id" TEXT NOT NULL,
    "contrato_id" TEXT,
    "valor" DECIMAL(10,2) NOT NULL,
    "data_pagamento" TIMESTAMP(3) NOT NULL,
    "metodo" "MetodoPagamentoFornecedor" NOT NULL DEFAULT 'TRANSFERENCIA',
    "status" "StatusPagamentoFornecedor" NOT NULL DEFAULT 'PENDENTE',
    "referencia" TEXT,
    "observacoes" TEXT,
    "autorizado_por" TEXT,
    "criado_por" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pagamentos_fornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "termos_responsabilidade_user_id_idx" ON "termos_responsabilidade"("user_id");

-- CreateIndex
CREATE INDEX "termos_responsabilidade_instituicao_id_idx" ON "termos_responsabilidade"("instituicao_id");

-- CreateIndex
CREATE INDEX "termos_responsabilidade_operacao_idx" ON "termos_responsabilidade"("operacao");

-- CreateIndex
CREATE INDEX "termos_legais_instituicao_id_tipo_acao_ativo_idx" ON "termos_legais"("instituicao_id", "tipo_acao", "ativo");

-- CreateIndex
CREATE INDEX "termos_legais_tipo_acao_ativo_idx" ON "termos_legais"("tipo_acao", "ativo");

-- CreateIndex
CREATE INDEX "aceites_termos_legais_termo_id_idx" ON "aceites_termos_legais"("termo_id");

-- CreateIndex
CREATE INDEX "aceites_termos_legais_instituicao_id_idx" ON "aceites_termos_legais"("instituicao_id");

-- CreateIndex
CREATE INDEX "aceites_termos_legais_user_id_idx" ON "aceites_termos_legais"("user_id");

-- CreateIndex
CREATE INDEX "aceites_termos_legais_termo_id_user_id_idx" ON "aceites_termos_legais"("termo_id", "user_id");

-- CreateIndex
CREATE INDEX "fornecedores_instituicao_id_idx" ON "fornecedores"("instituicao_id");

-- CreateIndex
CREATE INDEX "fornecedores_status_idx" ON "fornecedores"("status");

-- CreateIndex
CREATE INDEX "fornecedores_tipo_servico_idx" ON "fornecedores"("tipo_servico");

-- CreateIndex
CREATE INDEX "contratos_fornecedor_instituicao_id_idx" ON "contratos_fornecedor"("instituicao_id");

-- CreateIndex
CREATE INDEX "contratos_fornecedor_fornecedor_id_idx" ON "contratos_fornecedor"("fornecedor_id");

-- CreateIndex
CREATE INDEX "contratos_fornecedor_status_idx" ON "contratos_fornecedor"("status");

-- CreateIndex
CREATE INDEX "contratos_fornecedor_tipo_contrato_idx" ON "contratos_fornecedor"("tipo_contrato");

-- CreateIndex
CREATE INDEX "pagamentos_fornecedor_instituicao_id_idx" ON "pagamentos_fornecedor"("instituicao_id");

-- CreateIndex
CREATE INDEX "pagamentos_fornecedor_fornecedor_id_idx" ON "pagamentos_fornecedor"("fornecedor_id");

-- CreateIndex
CREATE INDEX "pagamentos_fornecedor_contrato_id_idx" ON "pagamentos_fornecedor"("contrato_id");

-- CreateIndex
CREATE INDEX "pagamentos_fornecedor_status_idx" ON "pagamentos_fornecedor"("status");

-- CreateIndex
CREATE INDEX "pagamentos_fornecedor_data_pagamento_idx" ON "pagamentos_fornecedor"("data_pagamento");

-- CreateIndex
CREATE INDEX "backup_history_instituicao_id_status_retencao_idx" ON "backup_history"("instituicao_id", "status_retencao");

-- CreateIndex
CREATE INDEX "backup_history_hash_sha256_idx" ON "backup_history"("hash_sha256");

-- AddForeignKey
ALTER TABLE "termos_responsabilidade" ADD CONSTRAINT "termos_responsabilidade_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "termos_responsabilidade" ADD CONSTRAINT "termos_responsabilidade_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "termos_legais" ADD CONSTRAINT "termos_legais_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aceites_termos_legais" ADD CONSTRAINT "aceites_termos_legais_termo_id_fkey" FOREIGN KEY ("termo_id") REFERENCES "termos_legais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aceites_termos_legais" ADD CONSTRAINT "aceites_termos_legais_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aceites_termos_legais" ADD CONSTRAINT "aceites_termos_legais_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fornecedores" ADD CONSTRAINT "fornecedores_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos_fornecedor" ADD CONSTRAINT "contratos_fornecedor_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos_fornecedor" ADD CONSTRAINT "contratos_fornecedor_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos_fornecedor" ADD CONSTRAINT "pagamentos_fornecedor_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos_fornecedor" ADD CONSTRAINT "pagamentos_fornecedor_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos_fornecedor" ADD CONSTRAINT "pagamentos_fornecedor_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos_fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
