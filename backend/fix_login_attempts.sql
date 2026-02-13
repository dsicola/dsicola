-- Script para adicionar colunas faltantes na tabela login_attempts
-- Execute este script diretamente no banco de dados PostgreSQL

-- Adicionar campos de segurança ao LoginAttempt (se não existirem)
ALTER TABLE "login_attempts" ADD COLUMN IF NOT EXISTS "ip_origem" TEXT;
ALTER TABLE "login_attempts" ADD COLUMN IF NOT EXISTS "user_agent" TEXT;
ALTER TABLE "login_attempts" ADD COLUMN IF NOT EXISTS "instituicao_id" TEXT;

-- Adicionar índices para melhor performance (se não existirem)
CREATE INDEX IF NOT EXISTS "login_attempts_instituicao_id_idx" ON "login_attempts"("instituicao_id");
CREATE INDEX IF NOT EXISTS "login_attempts_locked_until_idx" ON "login_attempts"("locked_until");
CREATE INDEX IF NOT EXISTS "login_attempts_last_attempt_at_idx" ON "login_attempts"("last_attempt_at");

-- Adicionar foreign key para instituição (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'login_attempts_instituicao_id_fkey'
  ) THEN
    ALTER TABLE "login_attempts" 
    ADD CONSTRAINT "login_attempts_instituicao_id_fkey" 
    FOREIGN KEY ("instituicao_id") 
    REFERENCES "instituicoes"("id") 
    ON DELETE SET NULL 
    ON UPDATE CASCADE;
  END IF;
END $$;

