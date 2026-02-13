-- AlterTable: Adicionar campos de segurança ao LoginAttempt
-- Só executa se a tabela login_attempts existir (shadow DB aplica migrations antes do init)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'login_attempts') THEN
    ALTER TABLE "login_attempts" ADD COLUMN IF NOT EXISTS "ip_origem" TEXT;
    ALTER TABLE "login_attempts" ADD COLUMN IF NOT EXISTS "user_agent" TEXT;
    ALTER TABLE "login_attempts" ADD COLUMN IF NOT EXISTS "instituicao_id" TEXT;
  END IF;
END $$;

-- Adicionar índices para melhor performance
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'login_attempts') THEN
    CREATE INDEX IF NOT EXISTS "login_attempts_instituicao_id_idx" ON "login_attempts"("instituicao_id");
    CREATE INDEX IF NOT EXISTS "login_attempts_locked_until_idx" ON "login_attempts"("locked_until");
    CREATE INDEX IF NOT EXISTS "login_attempts_last_attempt_at_idx" ON "login_attempts"("last_attempt_at");
  END IF;
END $$;

-- Adicionar foreign key para instituição
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'login_attempts')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'login_attempts_instituicao_id_fkey') THEN
    ALTER TABLE "login_attempts" 
    ADD CONSTRAINT "login_attempts_instituicao_id_fkey" 
    FOREIGN KEY ("instituicao_id") 
    REFERENCES "instituicoes"("id") 
    ON DELETE SET NULL 
    ON UPDATE CASCADE;
  END IF;
END $$;

