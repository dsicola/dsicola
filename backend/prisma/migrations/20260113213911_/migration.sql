/*
  Warnings:

  - The `semestre` column on the `turmas` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `plano_ensino_id` to the `aulas_lancadas` table without a default value. This is not possible if the table is not empty.
  - Made the column `instituicao_id` on table `aulas_lancadas` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `professor_id` to the `avaliacoes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `turma_id` to the `avaliacoes` table without a default value. This is not possible if the table is not empty.
  - Made the column `curso_id` on table `disciplinas` required. This step will fail if there are existing NULL values in that column.
  - Made the column `ano_letivo_id` on table `matriculas` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `plano_ensino_id` to the `notas` table without a default value. This is not possible if the table is not empty.
  - Made the column `instituicao_id` on table `presencas` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "EscopoReabertura" AS ENUM ('NOTAS', 'PRESENCAS', 'AVALIACOES', 'MATRICULAS', 'GERAL');

-- CreateEnum
CREATE TYPE "TipoEventoGovernamental" AS ENUM ('MATRICULA', 'CONCLUSAO', 'DIPLOMA', 'TRANSFERENCIA', 'CANCELAMENTO_MATRICULA');

-- CreateEnum
CREATE TYPE "StatusEventoGovernamental" AS ENUM ('PENDENTE', 'ENVIADO', 'ERRO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "CriterioEquivalencia" AS ENUM ('EQUIVALENCIA', 'DISPENSA');

-- CreateEnum
CREATE TYPE "TipoConclusao" AS ENUM ('CONCLUIDO', 'APROVEITAMENTO', 'CERTIFICACAO');

-- CreateEnum
CREATE TYPE "StatusConclusao" AS ENUM ('PENDENTE', 'VALIDADO', 'CONCLUIDO', 'REJEITADO');

-- DropForeignKey
ALTER TABLE "aulas_lancadas" DROP CONSTRAINT "aulas_lancadas_instituicao_id_fkey";

-- DropForeignKey
ALTER TABLE "disciplinas" DROP CONSTRAINT "disciplinas_curso_id_fkey";

-- DropForeignKey
ALTER TABLE "matriculas_anuais" DROP CONSTRAINT "matriculas_anuais_ano_letivo_id_fkey";

-- DropForeignKey
ALTER TABLE "presencas" DROP CONSTRAINT "presencas_instituicao_id_fkey";

-- AlterTable
ALTER TABLE "aulas_lancadas" ADD COLUMN     "carga_horaria" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "conteudo_ministrado" TEXT,
ADD COLUMN     "criado_por" TEXT,
ADD COLUMN     "hora_fim" TEXT,
ADD COLUMN     "hora_inicio" TEXT,
ADD COLUMN     "plano_ensino_id" TEXT NOT NULL,
ALTER COLUMN "instituicao_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "avaliacoes" ADD COLUMN     "professor_id" TEXT NOT NULL,
ADD COLUMN     "turma_id" TEXT NOT NULL,
ALTER COLUMN "trimestre" DROP NOT NULL,
ALTER COLUMN "peso" DROP NOT NULL;

-- AlterTable
ALTER TABLE "configuracoes_instituicao" ADD COLUMN     "integracao_governo_ativa" BOOLEAN DEFAULT false,
ADD COLUMN     "integracao_governo_token" TEXT,
ADD COLUMN     "integracao_governo_url" TEXT;

-- AlterTable
ALTER TABLE "disciplinas" ALTER COLUMN "semestre" DROP NOT NULL,
ALTER COLUMN "curso_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "logs_auditoria" ADD COLUMN     "campos_alterados" JSONB,
ADD COLUMN     "dominio" TEXT;

-- AlterTable
ALTER TABLE "matriculas" ALTER COLUMN "ano_letivo_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "matriculas_anuais" ALTER COLUMN "ano_letivo" DROP NOT NULL,
ALTER COLUMN "ano_letivo_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "notas" ADD COLUMN     "ano_letivo_id" TEXT,
ADD COLUMN     "plano_ensino_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "presencas" ADD COLUMN     "origem" "OrigemPresenca" NOT NULL DEFAULT 'MANUAL',
ALTER COLUMN "status" SET DEFAULT 'AUSENTE',
ALTER COLUMN "instituicao_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "turmas" ALTER COLUMN "ano" DROP NOT NULL,
DROP COLUMN "semestre",
ADD COLUMN     "semestre" INTEGER;

-- CreateTable
CREATE TABLE "notas_historico" (
    "id" TEXT NOT NULL,
    "nota_id" TEXT NOT NULL,
    "valor_anterior" DECIMAL(5,2) NOT NULL,
    "valor_novo" DECIMAL(5,2) NOT NULL,
    "motivo" TEXT NOT NULL,
    "observacoes" TEXT,
    "corrigido_por" TEXT NOT NULL,
    "instituicao_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notas_historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reaberturas_ano_letivo" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "ano_letivo_id" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "escopo" "EscopoReabertura" NOT NULL DEFAULT 'GERAL',
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "data_fim" TIMESTAMP(3) NOT NULL,
    "autorizado_por" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "encerrado_em" TIMESTAMP(3),
    "encerrado_por" TEXT,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reaberturas_ano_letivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_governamentais" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "tipo_evento" "TipoEventoGovernamental" NOT NULL,
    "payload_json" JSONB NOT NULL,
    "status" "StatusEventoGovernamental" NOT NULL DEFAULT 'PENDENTE',
    "protocolo" TEXT,
    "enviado_em" TIMESTAMP(3),
    "erro" TEXT,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "criado_por" TEXT,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eventos_governamentais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_academico" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "aluno_id" TEXT NOT NULL,
    "ano_letivo_id" TEXT NOT NULL,
    "plano_ensino_id" TEXT NOT NULL,
    "disciplina_id" TEXT NOT NULL,
    "curso_id" TEXT,
    "classe_id" TEXT,
    "turma_id" TEXT,
    "carga_horaria" INTEGER NOT NULL,
    "total_aulas" INTEGER NOT NULL DEFAULT 0,
    "presencas" INTEGER NOT NULL DEFAULT 0,
    "faltas" INTEGER NOT NULL DEFAULT 0,
    "faltas_justificadas" INTEGER NOT NULL DEFAULT 0,
    "percentual_frequencia" DECIMAL(5,2) NOT NULL,
    "media_final" DECIMAL(5,2) NOT NULL,
    "media_parcial" DECIMAL(5,2),
    "situacao_academica" TEXT NOT NULL,
    "origem_encerramento" BOOLEAN NOT NULL DEFAULT true,
    "gerado_por" TEXT,
    "gerado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_academico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equivalencias_disciplinas" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "aluno_id" TEXT NOT NULL,
    "curso_origem_id" TEXT,
    "disciplina_origem_id" TEXT,
    "carga_horaria_origem" INTEGER NOT NULL,
    "nota_origem" DECIMAL(5,2),
    "curso_destino_id" TEXT NOT NULL,
    "disciplina_destino_id" TEXT NOT NULL,
    "carga_horaria_equivalente" INTEGER NOT NULL,
    "criterio" "CriterioEquivalencia" NOT NULL DEFAULT 'EQUIVALENCIA',
    "observacao" TEXT,
    "deferido" BOOLEAN NOT NULL DEFAULT false,
    "deferido_por" TEXT,
    "deferido_em" TIMESTAMP(3),
    "instituicao_origem_nome" TEXT,
    "disciplina_origem_nome" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equivalencias_disciplinas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conclusoes_cursos" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "aluno_id" TEXT NOT NULL,
    "curso_id" TEXT,
    "classe_id" TEXT,
    "tipo_conclusao" "TipoConclusao" NOT NULL DEFAULT 'CONCLUIDO',
    "status" "StatusConclusao" NOT NULL DEFAULT 'PENDENTE',
    "data_conclusao" TIMESTAMP(3) NOT NULL,
    "numero_ato" TEXT,
    "observacoes" TEXT,
    "disciplinas_concluidas" INTEGER NOT NULL DEFAULT 0,
    "carga_horaria_total" INTEGER NOT NULL DEFAULT 0,
    "frequencia_media" DECIMAL(5,2),
    "media_geral" DECIMAL(5,2),
    "registrado_por" TEXT NOT NULL,
    "validado_por" TEXT,
    "validado_em" TIMESTAMP(3),
    "concluido_por" TEXT,
    "concluido_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conclusoes_cursos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colacoes_grau" (
    "id" TEXT NOT NULL,
    "conclusao_curso_id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "data_colacao" TIMESTAMP(3) NOT NULL,
    "numero_ata" TEXT,
    "local_colacao" TEXT,
    "observacoes" TEXT,
    "registrado_por" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "colacoes_grau_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificados" (
    "id" TEXT NOT NULL,
    "conclusao_curso_id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "numero_certificado" TEXT NOT NULL,
    "data_emissao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "livro" TEXT,
    "folha" TEXT,
    "observacoes" TEXT,
    "emitido_por" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notas_historico_nota_id_idx" ON "notas_historico"("nota_id");

-- CreateIndex
CREATE INDEX "notas_historico_corrigido_por_idx" ON "notas_historico"("corrigido_por");

-- CreateIndex
CREATE INDEX "notas_historico_instituicao_id_idx" ON "notas_historico"("instituicao_id");

-- CreateIndex
CREATE INDEX "notas_historico_created_at_idx" ON "notas_historico"("created_at");

-- CreateIndex
CREATE INDEX "reaberturas_ano_letivo_instituicao_id_idx" ON "reaberturas_ano_letivo"("instituicao_id");

-- CreateIndex
CREATE INDEX "reaberturas_ano_letivo_ano_letivo_id_idx" ON "reaberturas_ano_letivo"("ano_letivo_id");

-- CreateIndex
CREATE INDEX "reaberturas_ano_letivo_ativo_idx" ON "reaberturas_ano_letivo"("ativo");

-- CreateIndex
CREATE INDEX "reaberturas_ano_letivo_data_fim_idx" ON "reaberturas_ano_letivo"("data_fim");

-- CreateIndex
CREATE INDEX "eventos_governamentais_instituicao_id_idx" ON "eventos_governamentais"("instituicao_id");

-- CreateIndex
CREATE INDEX "eventos_governamentais_tipo_evento_idx" ON "eventos_governamentais"("tipo_evento");

-- CreateIndex
CREATE INDEX "eventos_governamentais_status_idx" ON "eventos_governamentais"("status");

-- CreateIndex
CREATE INDEX "eventos_governamentais_created_at_idx" ON "eventos_governamentais"("created_at");

-- CreateIndex
CREATE INDEX "historico_academico_instituicao_id_idx" ON "historico_academico"("instituicao_id");

-- CreateIndex
CREATE INDEX "historico_academico_aluno_id_idx" ON "historico_academico"("aluno_id");

-- CreateIndex
CREATE INDEX "historico_academico_ano_letivo_id_idx" ON "historico_academico"("ano_letivo_id");

-- CreateIndex
CREATE INDEX "historico_academico_plano_ensino_id_idx" ON "historico_academico"("plano_ensino_id");

-- CreateIndex
CREATE INDEX "historico_academico_disciplina_id_idx" ON "historico_academico"("disciplina_id");

-- CreateIndex
CREATE INDEX "historico_academico_gerado_em_idx" ON "historico_academico"("gerado_em");

-- CreateIndex
CREATE UNIQUE INDEX "historico_academico_instituicao_id_aluno_id_ano_letivo_id_p_key" ON "historico_academico"("instituicao_id", "aluno_id", "ano_letivo_id", "plano_ensino_id");

-- CreateIndex
CREATE INDEX "equivalencias_disciplinas_instituicao_id_idx" ON "equivalencias_disciplinas"("instituicao_id");

-- CreateIndex
CREATE INDEX "equivalencias_disciplinas_aluno_id_idx" ON "equivalencias_disciplinas"("aluno_id");

-- CreateIndex
CREATE INDEX "equivalencias_disciplinas_disciplina_destino_id_idx" ON "equivalencias_disciplinas"("disciplina_destino_id");

-- CreateIndex
CREATE INDEX "equivalencias_disciplinas_deferido_idx" ON "equivalencias_disciplinas"("deferido");

-- CreateIndex
CREATE INDEX "equivalencias_disciplinas_deferido_em_idx" ON "equivalencias_disciplinas"("deferido_em");

-- CreateIndex
CREATE UNIQUE INDEX "equivalencias_disciplinas_instituicao_id_aluno_id_disciplin_key" ON "equivalencias_disciplinas"("instituicao_id", "aluno_id", "disciplina_destino_id");

-- CreateIndex
CREATE INDEX "conclusoes_cursos_instituicao_id_idx" ON "conclusoes_cursos"("instituicao_id");

-- CreateIndex
CREATE INDEX "conclusoes_cursos_aluno_id_idx" ON "conclusoes_cursos"("aluno_id");

-- CreateIndex
CREATE INDEX "conclusoes_cursos_curso_id_idx" ON "conclusoes_cursos"("curso_id");

-- CreateIndex
CREATE INDEX "conclusoes_cursos_classe_id_idx" ON "conclusoes_cursos"("classe_id");

-- CreateIndex
CREATE INDEX "conclusoes_cursos_data_conclusao_idx" ON "conclusoes_cursos"("data_conclusao");

-- CreateIndex
CREATE INDEX "conclusoes_cursos_status_idx" ON "conclusoes_cursos"("status");

-- CreateIndex
CREATE UNIQUE INDEX "conclusoes_cursos_instituicao_id_aluno_id_curso_id_key" ON "conclusoes_cursos"("instituicao_id", "aluno_id", "curso_id");

-- CreateIndex
CREATE UNIQUE INDEX "conclusoes_cursos_instituicao_id_aluno_id_classe_id_key" ON "conclusoes_cursos"("instituicao_id", "aluno_id", "classe_id");

-- CreateIndex
CREATE UNIQUE INDEX "colacoes_grau_conclusao_curso_id_key" ON "colacoes_grau"("conclusao_curso_id");

-- CreateIndex
CREATE INDEX "colacoes_grau_instituicao_id_idx" ON "colacoes_grau"("instituicao_id");

-- CreateIndex
CREATE INDEX "colacoes_grau_conclusao_curso_id_idx" ON "colacoes_grau"("conclusao_curso_id");

-- CreateIndex
CREATE INDEX "colacoes_grau_data_colacao_idx" ON "colacoes_grau"("data_colacao");

-- CreateIndex
CREATE UNIQUE INDEX "certificados_conclusao_curso_id_key" ON "certificados"("conclusao_curso_id");

-- CreateIndex
CREATE UNIQUE INDEX "certificados_numero_certificado_key" ON "certificados"("numero_certificado");

-- CreateIndex
CREATE INDEX "certificados_instituicao_id_idx" ON "certificados"("instituicao_id");

-- CreateIndex
CREATE INDEX "certificados_conclusao_curso_id_idx" ON "certificados"("conclusao_curso_id");

-- CreateIndex
CREATE INDEX "certificados_numero_certificado_idx" ON "certificados"("numero_certificado");

-- CreateIndex
CREATE INDEX "certificados_data_emissao_idx" ON "certificados"("data_emissao");

-- CreateIndex
CREATE INDEX "aulas_lancadas_plano_ensino_id_idx" ON "aulas_lancadas"("plano_ensino_id");

-- CreateIndex
CREATE INDEX "avaliacoes_turma_id_idx" ON "avaliacoes"("turma_id");

-- CreateIndex
CREATE INDEX "avaliacoes_professor_id_idx" ON "avaliacoes"("professor_id");

-- CreateIndex
CREATE INDEX "logs_auditoria_dominio_idx" ON "logs_auditoria"("dominio");

-- CreateIndex
CREATE INDEX "notas_plano_ensino_id_idx" ON "notas"("plano_ensino_id");

-- CreateIndex
CREATE INDEX "notas_ano_letivo_id_idx" ON "notas"("ano_letivo_id");

-- AddForeignKey
ALTER TABLE "disciplinas" ADD CONSTRAINT "disciplinas_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas_anuais" ADD CONSTRAINT "matriculas_anuais_ano_letivo_id_fkey" FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas" ADD CONSTRAINT "notas_plano_ensino_id_fkey" FOREIGN KEY ("plano_ensino_id") REFERENCES "plano_ensino"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas" ADD CONSTRAINT "notas_ano_letivo_id_fkey" FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_historico" ADD CONSTRAINT "notas_historico_nota_id_fkey" FOREIGN KEY ("nota_id") REFERENCES "notas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_historico" ADD CONSTRAINT "notas_historico_corrigido_por_fkey" FOREIGN KEY ("corrigido_por") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_historico" ADD CONSTRAINT "notas_historico_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reaberturas_ano_letivo" ADD CONSTRAINT "reaberturas_ano_letivo_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reaberturas_ano_letivo" ADD CONSTRAINT "reaberturas_ano_letivo_ano_letivo_id_fkey" FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reaberturas_ano_letivo" ADD CONSTRAINT "reaberturas_ano_letivo_autorizado_por_fkey" FOREIGN KEY ("autorizado_por") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reaberturas_ano_letivo" ADD CONSTRAINT "reaberturas_ano_letivo_encerrado_por_fkey" FOREIGN KEY ("encerrado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aulas_lancadas" ADD CONSTRAINT "aulas_lancadas_plano_ensino_id_fkey" FOREIGN KEY ("plano_ensino_id") REFERENCES "plano_ensino"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aulas_lancadas" ADD CONSTRAINT "aulas_lancadas_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presencas" ADD CONSTRAINT "presencas_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_governamentais" ADD CONSTRAINT "eventos_governamentais_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_academico" ADD CONSTRAINT "historico_academico_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_academico" ADD CONSTRAINT "historico_academico_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_academico" ADD CONSTRAINT "historico_academico_ano_letivo_id_fkey" FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_academico" ADD CONSTRAINT "historico_academico_plano_ensino_id_fkey" FOREIGN KEY ("plano_ensino_id") REFERENCES "plano_ensino"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_academico" ADD CONSTRAINT "historico_academico_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "disciplinas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_academico" ADD CONSTRAINT "historico_academico_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_academico" ADD CONSTRAINT "historico_academico_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_academico" ADD CONSTRAINT "historico_academico_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equivalencias_disciplinas" ADD CONSTRAINT "equivalencias_disciplinas_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equivalencias_disciplinas" ADD CONSTRAINT "equivalencias_disciplinas_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equivalencias_disciplinas" ADD CONSTRAINT "equivalencias_disciplinas_curso_origem_id_fkey" FOREIGN KEY ("curso_origem_id") REFERENCES "cursos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equivalencias_disciplinas" ADD CONSTRAINT "equivalencias_disciplinas_disciplina_origem_id_fkey" FOREIGN KEY ("disciplina_origem_id") REFERENCES "disciplinas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equivalencias_disciplinas" ADD CONSTRAINT "equivalencias_disciplinas_curso_destino_id_fkey" FOREIGN KEY ("curso_destino_id") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equivalencias_disciplinas" ADD CONSTRAINT "equivalencias_disciplinas_disciplina_destino_id_fkey" FOREIGN KEY ("disciplina_destino_id") REFERENCES "disciplinas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equivalencias_disciplinas" ADD CONSTRAINT "equivalencias_disciplinas_deferido_por_fkey" FOREIGN KEY ("deferido_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conclusoes_cursos" ADD CONSTRAINT "conclusoes_cursos_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conclusoes_cursos" ADD CONSTRAINT "conclusoes_cursos_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conclusoes_cursos" ADD CONSTRAINT "conclusoes_cursos_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conclusoes_cursos" ADD CONSTRAINT "conclusoes_cursos_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colacoes_grau" ADD CONSTRAINT "colacoes_grau_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colacoes_grau" ADD CONSTRAINT "colacoes_grau_conclusao_curso_id_fkey" FOREIGN KEY ("conclusao_curso_id") REFERENCES "conclusoes_cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificados" ADD CONSTRAINT "certificados_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificados" ADD CONSTRAINT "certificados_conclusao_curso_id_fkey" FOREIGN KEY ("conclusao_curso_id") REFERENCES "conclusoes_cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
