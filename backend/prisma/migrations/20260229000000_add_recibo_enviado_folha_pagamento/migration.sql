-- AlterTable: recibo enviado por e-mail (folha de pagamento)
ALTER TABLE "folha_pagamento" ADD COLUMN IF NOT EXISTS "recibo_enviado_em" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "recibo_enviado_por" TEXT;
