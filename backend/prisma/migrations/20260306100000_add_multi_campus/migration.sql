-- CreateTable
CREATE TABLE "campus" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "codigo" TEXT,
    "endereco" TEXT,
    "telefone" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "instituicao_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campus_instituicao_id_idx" ON "campus"("instituicao_id");

-- CreateIndex
CREATE UNIQUE INDEX "campus_nome_instituicao_id_key" ON "campus"("nome", "instituicao_id");

-- AddForeignKey
ALTER TABLE "campus" ADD CONSTRAINT "campus_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Add campus_id to turnos
ALTER TABLE "turnos" ADD COLUMN "campus_id" TEXT;

-- AlterTable: Add campus_id to salas
ALTER TABLE "salas" ADD COLUMN "campus_id" TEXT;

-- AlterTable: Add campus_id to turmas
ALTER TABLE "turmas" ADD COLUMN "campus_id" TEXT;

-- AlterTable: Add campus_id to alojamentos
ALTER TABLE "alojamentos" ADD COLUMN "campus_id" TEXT;

-- AlterTable: Add campus_id to dispositivos_biometricos
ALTER TABLE "dispositivos_biometricos" ADD COLUMN "campus_id" TEXT;

-- AlterTable: Add multi_campus to planos
ALTER TABLE "planos" ADD COLUMN "multi_campus" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add multi_campus to configuracoes_instituicao
ALTER TABLE "configuracoes_instituicao" ADD COLUMN "multi_campus" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "turnos_campus_id_idx" ON "turnos"("campus_id");

-- CreateIndex
CREATE INDEX "salas_campus_id_idx" ON "salas"("campus_id");

-- CreateIndex
CREATE INDEX "turmas_campus_id_idx" ON "turmas"("campus_id");

-- CreateIndex
CREATE INDEX "alojamentos_campus_id_idx" ON "alojamentos"("campus_id");

-- CreateIndex
CREATE INDEX "dispositivos_biometricos_campus_id_idx" ON "dispositivos_biometricos"("campus_id");

-- AddForeignKey turnos
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey salas
ALTER TABLE "salas" ADD CONSTRAINT "salas_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey turmas
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey alojamentos
ALTER TABLE "alojamentos" ADD CONSTRAINT "alojamentos_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey dispositivos_biometricos
ALTER TABLE "dispositivos_biometricos" ADD CONSTRAINT "dispositivos_biometricos_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
