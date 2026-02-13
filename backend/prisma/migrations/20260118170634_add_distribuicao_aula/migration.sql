/*
  Warnings:

  - A unique constraint covering the columns `[codigo,instituicao_id]` on the table `disciplinas` will be added. If there are existing duplicate values, this will fail.
  - Made the column `instituicao_id` on table `disciplinas` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "disciplinas" DROP CONSTRAINT "disciplinas_curso_id_fkey";

-- DropForeignKey
ALTER TABLE "disciplinas" DROP CONSTRAINT "disciplinas_instituicao_id_fkey";

-- AlterTable
ALTER TABLE "configuracoes_instituicao" ADD COLUMN     "bloquear_certificados_por_financeiro" BOOLEAN DEFAULT false,
ADD COLUMN     "bloquear_documentos_por_financeiro" BOOLEAN DEFAULT false,
ADD COLUMN     "bloquear_matricula_por_financeiro" BOOLEAN DEFAULT false,
ADD COLUMN     "mensagem_bloqueio_certificados" TEXT,
ADD COLUMN     "mensagem_bloqueio_documentos" TEXT,
ADD COLUMN     "mensagem_bloqueio_matricula" TEXT,
ADD COLUMN     "permitir_aulas_com_bloqueio_financeiro" BOOLEAN DEFAULT true,
ADD COLUMN     "permitir_avaliacoes_com_bloqueio_financeiro" BOOLEAN DEFAULT true;

-- AlterTable
ALTER TABLE "disciplinas" ADD COLUMN     "ativa" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "carga_horaria_base" INTEGER,
ADD COLUMN     "codigo" TEXT,
ADD COLUMN     "descricao" TEXT,
ALTER COLUMN "curso_id" DROP NOT NULL,
ALTER COLUMN "instituicao_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "plano_ensino" ADD COLUMN     "semestre_id" TEXT;

-- CreateTable
CREATE TABLE "professores" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "professores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curso_disciplina" (
    "id" TEXT NOT NULL,
    "curso_id" TEXT NOT NULL,
    "disciplina_id" TEXT NOT NULL,
    "semestre" INTEGER,
    "trimestre" INTEGER,
    "carga_horaria" INTEGER,
    "obrigatoria" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "curso_disciplina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professor_curso" (
    "id" TEXT NOT NULL,
    "professor_id" TEXT NOT NULL,
    "curso_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "professor_curso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professor_disciplina" (
    "id" TEXT NOT NULL,
    "professor_id" TEXT NOT NULL,
    "disciplina_id" TEXT NOT NULL,
    "curso_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "professor_disciplina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distribuicao_aulas" (
    "id" TEXT NOT NULL,
    "plano_aula_id" TEXT NOT NULL,
    "plano_ensino_id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "distribuicao_aulas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "professores_user_id_key" ON "professores"("user_id");

-- CreateIndex
CREATE INDEX "professores_instituicao_id_idx" ON "professores"("instituicao_id");

-- CreateIndex
CREATE UNIQUE INDEX "professores_user_id_instituicao_id_key" ON "professores"("user_id", "instituicao_id");

-- CreateIndex
CREATE INDEX "curso_disciplina_curso_id_idx" ON "curso_disciplina"("curso_id");

-- CreateIndex
CREATE INDEX "curso_disciplina_disciplina_id_idx" ON "curso_disciplina"("disciplina_id");

-- CreateIndex
CREATE UNIQUE INDEX "curso_disciplina_curso_id_disciplina_id_key" ON "curso_disciplina"("curso_id", "disciplina_id");

-- CreateIndex
CREATE INDEX "professor_curso_professor_id_idx" ON "professor_curso"("professor_id");

-- CreateIndex
CREATE INDEX "professor_curso_curso_id_idx" ON "professor_curso"("curso_id");

-- CreateIndex
CREATE UNIQUE INDEX "professor_curso_professor_id_curso_id_key" ON "professor_curso"("professor_id", "curso_id");

-- CreateIndex
CREATE INDEX "professor_disciplina_professor_id_idx" ON "professor_disciplina"("professor_id");

-- CreateIndex
CREATE INDEX "professor_disciplina_disciplina_id_idx" ON "professor_disciplina"("disciplina_id");

-- CreateIndex
CREATE INDEX "professor_disciplina_curso_id_idx" ON "professor_disciplina"("curso_id");

-- CreateIndex
CREATE UNIQUE INDEX "professor_disciplina_professor_id_disciplina_id_curso_id_key" ON "professor_disciplina"("professor_id", "disciplina_id", "curso_id");

-- CreateIndex
CREATE INDEX "distribuicao_aulas_plano_aula_id_idx" ON "distribuicao_aulas"("plano_aula_id");

-- CreateIndex
CREATE INDEX "distribuicao_aulas_plano_ensino_id_idx" ON "distribuicao_aulas"("plano_ensino_id");

-- CreateIndex
CREATE INDEX "distribuicao_aulas_instituicao_id_idx" ON "distribuicao_aulas"("instituicao_id");

-- CreateIndex
CREATE INDEX "distribuicao_aulas_data_idx" ON "distribuicao_aulas"("data");

-- CreateIndex
CREATE UNIQUE INDEX "distribuicao_aulas_plano_aula_id_data_key" ON "distribuicao_aulas"("plano_aula_id", "data");

-- CreateIndex
CREATE INDEX "disciplinas_instituicao_id_idx" ON "disciplinas"("instituicao_id");

-- CreateIndex
CREATE UNIQUE INDEX "disciplinas_codigo_instituicao_id_key" ON "disciplinas"("codigo", "instituicao_id");

-- CreateIndex
CREATE INDEX "plano_ensino_semestre_id_idx" ON "plano_ensino"("semestre_id");

-- AddForeignKey
ALTER TABLE "disciplinas" ADD CONSTRAINT "disciplinas_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disciplinas" ADD CONSTRAINT "disciplinas_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professores" ADD CONSTRAINT "professores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professores" ADD CONSTRAINT "professores_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curso_disciplina" ADD CONSTRAINT "curso_disciplina_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curso_disciplina" ADD CONSTRAINT "curso_disciplina_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "disciplinas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professor_curso" ADD CONSTRAINT "professor_curso_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "professores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professor_curso" ADD CONSTRAINT "professor_curso_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professor_disciplina" ADD CONSTRAINT "professor_disciplina_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "professores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professor_disciplina" ADD CONSTRAINT "professor_disciplina_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "disciplinas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professor_disciplina" ADD CONSTRAINT "professor_disciplina_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plano_ensino" ADD CONSTRAINT "plano_ensino_semestre_id_fkey" FOREIGN KEY ("semestre_id") REFERENCES "semestres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distribuicao_aulas" ADD CONSTRAINT "distribuicao_aulas_plano_aula_id_fkey" FOREIGN KEY ("plano_aula_id") REFERENCES "plano_aulas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distribuicao_aulas" ADD CONSTRAINT "distribuicao_aulas_plano_ensino_id_fkey" FOREIGN KEY ("plano_ensino_id") REFERENCES "plano_ensino"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distribuicao_aulas" ADD CONSTRAINT "distribuicao_aulas_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
