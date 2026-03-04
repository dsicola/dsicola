-- Índice composto para listagem de mensalidades por aluno e status (ROADMAP-100)
CREATE INDEX IF NOT EXISTS "mensalidades_aluno_id_status_idx" ON "mensalidades"("aluno_id", "status");
