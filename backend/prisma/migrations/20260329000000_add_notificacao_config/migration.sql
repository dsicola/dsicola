-- Add notificacao_config to configuracoes_instituicao
-- Admin configura quais eventos enviam notificação e por quais canais (email, telegram, sms)
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "notificacao_config" JSONB;
