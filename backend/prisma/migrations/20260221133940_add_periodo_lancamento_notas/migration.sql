/*
  Warnings:

  - Made the column `status` on table `horarios` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "documentos_emitidos" DROP CONSTRAINT "documentos_emitidos_tipo_documento_id_fkey";

-- DropForeignKey
ALTER TABLE "horarios" DROP CONSTRAINT "horarios_turma_id_fkey";

-- AlterTable
ALTER TABLE "documentos_emitidos" ALTER COLUMN "status" SET DEFAULT 'ATIVO';

-- AlterTable
ALTER TABLE "horarios" ALTER COLUMN "status" SET NOT NULL;

-- AlterTable
ALTER TABLE "video_aulas" ALTER COLUMN "perfil_alvo" SET DATA TYPE TEXT;

-- CreateIndex
CREATE INDEX "horarios_turma_id_idx" ON "horarios"("turma_id");

-- AddForeignKey
ALTER TABLE "horarios" ADD CONSTRAINT "horarios_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_emitidos" ADD CONSTRAINT "documentos_emitidos_tipo_documento_id_fkey" FOREIGN KEY ("tipo_documento_id") REFERENCES "tipos_documento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "periodos_lancamento_notas_instituicao_ano_tipo_numero_key" RENAME TO "periodos_lancamento_notas_instituicao_id_ano_letivo_id_tipo_key";
