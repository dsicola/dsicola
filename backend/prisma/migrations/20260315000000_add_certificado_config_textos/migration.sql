-- Textos e labels configuráveis do certificado Ensino Superior
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "cargo_assinatura_1" TEXT;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "cargo_assinatura_2" TEXT;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "texto_fecho_certificado" TEXT;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "texto_rodape_certificado" TEXT;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "bi_complementar_certificado" TEXT;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "label_media_final_certificado" TEXT;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "label_valores_certificado" TEXT;
