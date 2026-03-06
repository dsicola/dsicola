-- AlterTable
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "impressao_direta" BOOLEAN DEFAULT false;
