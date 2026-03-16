-- AlterTable: imagem de fundo para documentos oficiais (certificados, declarações)
ALTER TABLE "configuracoes_instituicao" ADD COLUMN "imagem_fundo_documento_url" TEXT;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN "imagem_fundo_documento_data" BYTEA;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN "imagem_fundo_documento_content_type" TEXT;
