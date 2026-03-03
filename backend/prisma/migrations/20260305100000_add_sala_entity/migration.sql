-- CreateTable
CREATE TABLE "salas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "capacidade" INTEGER,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "instituicao_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "salas_instituicao_id_idx" ON "salas"("instituicao_id");

-- CreateIndex
CREATE UNIQUE INDEX "salas_nome_instituicao_id_key" ON "salas"("nome", "instituicao_id");

-- AddForeignKey
ALTER TABLE "salas" ADD CONSTRAINT "salas_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
