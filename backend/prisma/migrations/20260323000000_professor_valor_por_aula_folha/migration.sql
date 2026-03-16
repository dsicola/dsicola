-- AlterTable: add valorPorAula, rename salario_base comment (salarioBase stays)
ALTER TABLE "professores" ADD COLUMN "valor_por_aula" DECIMAL(10,2);

-- CreateTable: FolhaPagamentoProfessor
CREATE TABLE "folha_pagamento_professor" (
    "id" TEXT NOT NULL,
    "professor_id" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "total_aulas" INTEGER NOT NULL DEFAULT 0,
    "valor_por_aula" DECIMAL(10,2) NOT NULL,
    "salario_bruto" DECIMAL(10,2) NOT NULL,
    "faltas_nao_justificadas" INTEGER NOT NULL DEFAULT 0,
    "valor_desconto_faltas" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "outros_descontos" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "bonus" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "salario_liquido" DECIMAL(10,2) NOT NULL,
    "status" "StatusFolhaPagamento" NOT NULL DEFAULT 'DRAFT',
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "folha_pagamento_professor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "folha_pagamento_professor_professor_id_mes_ano_key" ON "folha_pagamento_professor"("professor_id", "mes", "ano");
CREATE INDEX "folha_pagamento_professor_professor_id_idx" ON "folha_pagamento_professor"("professor_id");
CREATE INDEX "folha_pagamento_professor_mes_ano_idx" ON "folha_pagamento_professor"("mes", "ano");

-- AddForeignKey
ALTER TABLE "folha_pagamento_professor" ADD CONSTRAINT "folha_pagamento_professor_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "professores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
