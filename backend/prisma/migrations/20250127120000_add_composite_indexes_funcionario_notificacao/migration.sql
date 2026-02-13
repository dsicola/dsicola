-- Adicionar índices otimizados para Funcionario e Notificacao
-- Só executa se as tabelas existirem (shadow DB aplica migrations antes do init)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'funcionarios') THEN
    CREATE INDEX IF NOT EXISTS "funcionarios_user_id_idx" ON "funcionarios"("user_id");
    CREATE INDEX IF NOT EXISTS "funcionarios_user_id_instituicao_id_idx" ON "funcionarios"("user_id", "instituicao_id");
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notificacoes') THEN
    CREATE INDEX IF NOT EXISTS "notificacoes_instituicao_id_user_id_idx" ON "notificacoes"("instituicao_id", "user_id");
  END IF;
END $$;

