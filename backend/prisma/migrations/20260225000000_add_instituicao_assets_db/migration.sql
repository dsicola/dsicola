-- AlterTable: armazenar logo, capa e favicon no banco quando volume/S3 indisponível (Railway, Vercel)
ALTER TABLE "configuracoes_instituicao" ADD COLUMN "logo_data" BYTEA;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN "logo_content_type" TEXT;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN "imagem_capa_login_data" BYTEA;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN "imagem_capa_login_content_type" TEXT;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN "favicon_data" BYTEA;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN "favicon_content_type" TEXT;
