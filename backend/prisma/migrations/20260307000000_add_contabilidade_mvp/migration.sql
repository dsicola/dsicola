-- CreateEnum
CREATE TYPE "TipoContaContabil" AS ENUM ('ATIVO', 'PASSIVO', 'PATRIMONIO_LIQUIDO', 'RECEITA', 'DESPESA');

-- CreateTable
CREATE TABLE "plano_contas" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" "TipoContaContabil" NOT NULL,
    "conta_pai_id" TEXT,
    "nivel" INTEGER NOT NULL DEFAULT 1,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plano_contas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lancamentos_contabeis" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "descricao" TEXT NOT NULL,
    "fechado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lancamentos_contabeis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lancamentos_contabeis_linhas" (
    "id" TEXT NOT NULL,
    "lancamento_id" TEXT NOT NULL,
    "conta_id" TEXT NOT NULL,
    "descricao" TEXT,
    "debito" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "credito" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "lancamentos_contabeis_linhas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plano_contas_instituicao_id_codigo_key" ON "plano_contas"("instituicao_id", "codigo");

-- CreateIndex
CREATE INDEX "plano_contas_instituicao_id_idx" ON "plano_contas"("instituicao_id");

-- CreateIndex
CREATE INDEX "plano_contas_conta_pai_id_idx" ON "plano_contas"("conta_pai_id");

-- CreateIndex
CREATE UNIQUE INDEX "lancamentos_contabeis_instituicao_id_numero_key" ON "lancamentos_contabeis"("instituicao_id", "numero");

-- CreateIndex
CREATE INDEX "lancamentos_contabeis_instituicao_id_idx" ON "lancamentos_contabeis"("instituicao_id");

-- CreateIndex
CREATE INDEX "lancamentos_contabeis_data_idx" ON "lancamentos_contabeis"("data");

-- CreateIndex
CREATE INDEX "lancamentos_contabeis_linhas_lancamento_id_idx" ON "lancamentos_contabeis_linhas"("lancamento_id");

-- CreateIndex
CREATE INDEX "lancamentos_contabeis_linhas_conta_id_idx" ON "lancamentos_contabeis_linhas"("conta_id");

-- AddForeignKey
ALTER TABLE "plano_contas" ADD CONSTRAINT "plano_contas_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plano_contas" ADD CONSTRAINT "plano_contas_conta_pai_id_fkey" FOREIGN KEY ("conta_pai_id") REFERENCES "plano_contas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_contabeis" ADD CONSTRAINT "lancamentos_contabeis_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_contabeis_linhas" ADD CONSTRAINT "lancamentos_contabeis_linhas_lancamento_id_fkey" FOREIGN KEY ("lancamento_id") REFERENCES "lancamentos_contabeis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_contabeis_linhas" ADD CONSTRAINT "lancamentos_contabeis_linhas_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "plano_contas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
