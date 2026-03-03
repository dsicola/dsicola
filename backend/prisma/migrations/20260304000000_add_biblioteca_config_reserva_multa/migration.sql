-- CreateEnum
CREATE TYPE "StatusReservaBiblioteca" AS ENUM ('PENDENTE', 'ATENDIDA', 'EXPIRADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "StatusMultaBiblioteca" AS ENUM ('PENDENTE', 'PAGA', 'ISENTA');

-- CreateTable
CREATE TABLE "biblioteca_config" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "limite_emprestimos_por_usuario" INTEGER NOT NULL DEFAULT 5,
    "multa_por_dia_atraso" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "dias_para_notificar_vencimento" INTEGER NOT NULL DEFAULT 3,
    "dias_validade_reserva" INTEGER NOT NULL DEFAULT 7,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "biblioteca_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas_biblioteca" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "data_reserva" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_expiracao" TIMESTAMP(3) NOT NULL,
    "status" "StatusReservaBiblioteca" NOT NULL DEFAULT 'PENDENTE',
    "instituicao_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservas_biblioteca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "multas_biblioteca" (
    "id" TEXT NOT NULL,
    "emprestimo_id" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "dias_atraso" INTEGER NOT NULL,
    "status" "StatusMultaBiblioteca" NOT NULL DEFAULT 'PENDENTE',
    "data_pagamento" TIMESTAMP(3),
    "observacoes" TEXT,
    "instituicao_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "multas_biblioteca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "biblioteca_config_instituicao_id_key" ON "biblioteca_config"("instituicao_id");

-- CreateIndex
CREATE INDEX "biblioteca_config_instituicao_id_idx" ON "biblioteca_config"("instituicao_id");

-- CreateIndex
CREATE INDEX "reservas_biblioteca_instituicao_id_idx" ON "reservas_biblioteca"("instituicao_id");

-- CreateIndex
CREATE INDEX "reservas_biblioteca_item_id_idx" ON "reservas_biblioteca"("item_id");

-- CreateIndex
CREATE INDEX "reservas_biblioteca_usuario_id_idx" ON "reservas_biblioteca"("usuario_id");

-- CreateIndex
CREATE INDEX "reservas_biblioteca_status_idx" ON "reservas_biblioteca"("status");

-- CreateIndex
CREATE INDEX "multas_biblioteca_instituicao_id_idx" ON "multas_biblioteca"("instituicao_id");

-- CreateIndex
CREATE INDEX "multas_biblioteca_emprestimo_id_idx" ON "multas_biblioteca"("emprestimo_id");

-- AddForeignKey
ALTER TABLE "biblioteca_config" ADD CONSTRAINT "biblioteca_config_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_biblioteca" ADD CONSTRAINT "reservas_biblioteca_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "biblioteca_itens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_biblioteca" ADD CONSTRAINT "reservas_biblioteca_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_biblioteca" ADD CONSTRAINT "reservas_biblioteca_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "multas_biblioteca" ADD CONSTRAINT "multas_biblioteca_emprestimo_id_fkey" FOREIGN KEY ("emprestimo_id") REFERENCES "emprestimos_biblioteca"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "multas_biblioteca" ADD CONSTRAINT "multas_biblioteca_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
