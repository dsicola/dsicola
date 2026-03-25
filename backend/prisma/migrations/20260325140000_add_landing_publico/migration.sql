-- Landing institucional (conteúdo público editável pelo admin)
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "landing_publico" JSONB;
