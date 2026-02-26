-- Índices para buscas e listagens em User (NIF, email, número matrícula)
-- PERFORMANCE-100: listagens rápidas por email, numeroIdentificacao, numeroIdentificacaoPublica

CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users"("email");
CREATE INDEX IF NOT EXISTS "users_numero_identificacao_idx" ON "users"("numero_identificacao");
CREATE INDEX IF NOT EXISTS "users_numero_identificacao_publica_idx" ON "users"("numero_identificacao_publica");
