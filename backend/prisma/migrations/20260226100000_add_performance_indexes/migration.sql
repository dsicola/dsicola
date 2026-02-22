-- Índices para otimizar queries de mensalidades, pagamentos, matrículas e roles
-- Usa IF NOT EXISTS para ser idempotente (evita erro se algum índice já existir)

CREATE INDEX IF NOT EXISTS "mensalidades_aluno_id_idx" ON "mensalidades"("aluno_id");
CREATE INDEX IF NOT EXISTS "mensalidades_status_idx" ON "mensalidades"("status");
CREATE INDEX IF NOT EXISTS "mensalidades_data_vencimento_idx" ON "mensalidades"("data_vencimento");
CREATE INDEX IF NOT EXISTS "mensalidades_data_pagamento_idx" ON "mensalidades"("data_pagamento");

CREATE INDEX IF NOT EXISTS "pagamentos_mensalidade_id_idx" ON "pagamentos"("mensalidade_id");
CREATE INDEX IF NOT EXISTS "pagamentos_data_pagamento_idx" ON "pagamentos"("data_pagamento");

CREATE INDEX IF NOT EXISTS "users_instituicao_id_idx" ON "users"("instituicao_id");

CREATE INDEX IF NOT EXISTS "matriculas_aluno_id_idx" ON "matriculas"("aluno_id");
CREATE INDEX IF NOT EXISTS "matriculas_turma_id_idx" ON "matriculas"("turma_id");
CREATE INDEX IF NOT EXISTS "matriculas_created_at_idx" ON "matriculas"("created_at");

CREATE INDEX IF NOT EXISTS "user_roles_instituicao_id_idx" ON "user_roles"("instituicao_id");
CREATE INDEX IF NOT EXISTS "user_roles_role_idx" ON "user_roles"("role");
