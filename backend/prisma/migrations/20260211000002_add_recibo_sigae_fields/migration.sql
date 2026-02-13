-- AlterTable: Add SIGAE fields to Recibo for immutability and PDF display
ALTER TABLE "recibos" ADD COLUMN IF NOT EXISTS "estudante_id" TEXT;
ALTER TABLE "recibos" ADD COLUMN IF NOT EXISTS "forma_pagamento" TEXT;
ALTER TABLE "recibos" ADD COLUMN IF NOT EXISTS "operador_id" TEXT;
ALTER TABLE "recibos" ADD COLUMN IF NOT EXISTS "valor_desconto" DECIMAL(10,2) DEFAULT 0;

-- Backfill existing records from related tables
UPDATE "recibos" r
SET 
  estudante_id = m.aluno_id,
  forma_pagamento = p.metodo_pagamento,
  operador_id = p.registrado_por,
  valor_desconto = COALESCE(m.valor_desconto, 0)
FROM "mensalidades" m
JOIN "pagamentos" p ON p.mensalidade_id = m.id
WHERE r.mensalidade_id = m.id AND r.pagamento_id = p.id;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "recibos_estudante_id_idx" ON "recibos"("estudante_id");
