-- AlterTable
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "taxa_matricula_padrao" DECIMAL(12,2);
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "mensalidade_padrao" DECIMAL(12,2);
