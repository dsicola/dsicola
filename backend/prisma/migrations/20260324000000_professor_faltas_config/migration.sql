-- AlterTable ParametrosSistema: add desconto falta professor
ALTER TABLE "parametros_sistema" ADD COLUMN "desconto_falta_professor_tipo" TEXT DEFAULT 'VALOR_AULA',
ADD COLUMN "desconto_falta_professor_valor" DECIMAL(10,2);

-- AlterTable FolhaPagamentoProfessor: faltas como Decimal (suporta 0.5, 1.5)
ALTER TABLE "folha_pagamento_professor" ALTER COLUMN "faltas_nao_justificadas" TYPE DECIMAL(5,2) USING "faltas_nao_justificadas"::decimal;

-- CreateTable ProfessorFalta
CREATE TABLE "professor_faltas" (
    "id" TEXT NOT NULL,
    "professor_id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "fracao_falta" DECIMAL(4,2) NOT NULL DEFAULT 1,
    "justificada" BOOLEAN NOT NULL DEFAULT false,
    "origem" TEXT NOT NULL DEFAULT 'MANUAL',
    "registado_por_id" TEXT,
    "observacoes" TEXT,
    "instituicao_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "professor_faltas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "professor_faltas_professor_id_idx" ON "professor_faltas"("professor_id");
CREATE INDEX "professor_faltas_data_idx" ON "professor_faltas"("data");
CREATE INDEX "professor_faltas_instituicao_id_idx" ON "professor_faltas"("instituicao_id");

-- AddForeignKey
ALTER TABLE "professor_faltas" ADD CONSTRAINT "professor_faltas_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "professores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "professor_faltas" ADD CONSTRAINT "professor_faltas_registado_por_id_fkey" FOREIGN KEY ("registado_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "professor_faltas" ADD CONSTRAINT "professor_faltas_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
