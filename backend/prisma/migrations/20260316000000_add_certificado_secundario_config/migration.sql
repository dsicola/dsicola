-- Textos e campos configuráveis do certificado Ensino Secundário (Angola - modelo II Ciclo)
-- Multi-tenant: cada instituição configura sua escola
-- Dois tipos: SECUNDARIO / SUPERIOR - cada um tem suas configs específicas

ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "republica_angola" TEXT;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "governo_provincia" TEXT;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "escola_nome_numero" TEXT;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "ensino_geral" TEXT;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "titulo_certificado_secundario" TEXT;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "texto_fecho_certificado_secundario" TEXT;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "cargo_assinatura_1_secundario" TEXT;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "cargo_assinatura_2_secundario" TEXT;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "nome_assinatura_1_secundario" TEXT;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "nome_assinatura_2_secundario" TEXT;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "label_resultado_final_secundario" TEXT;
