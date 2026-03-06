-- AlterTable: Configurações de Impressão completas
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "formato_padrao_impressao" TEXT DEFAULT 'A4';
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "numero_copias_recibo" INTEGER DEFAULT 1;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "nome_impressora_preferida" TEXT;
