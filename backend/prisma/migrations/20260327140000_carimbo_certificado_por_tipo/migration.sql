-- Carimbo/selo por tipo académico (configuração isolada por instituicao_id)
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "carimbo_certificado_secundario_url" TEXT;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "carimbo_certificado_secundario_data" BYTEA;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "carimbo_certificado_secundario_content_type" TEXT;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "carimbo_certificado_superior_url" TEXT;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "carimbo_certificado_superior_data" BYTEA;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "carimbo_certificado_superior_content_type" TEXT;
