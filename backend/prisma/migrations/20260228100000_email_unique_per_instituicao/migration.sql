-- Migration: Unicidade de email por instituição (multi-tenant)
-- OBJETIVO: Permitir o mesmo email em instituições diferentes; manter email único por instituição.
-- Requer PostgreSQL 15+ para NULLS NOT DISTINCT (trata NULL como igual em UNIQUE).

-- 1) Verificar conflitos: duplicatas (instituicao_id, email) na mesma instituição
DO $$
DECLARE
  conflict_count INTEGER;
  conflict_detail TEXT;
BEGIN
  SELECT COUNT(*), STRING_AGG(
    'instituicao_id=' || COALESCE(dup.instituicao_id::TEXT, 'NULL') || ', email=' || dup.email || ' (count=' || dup.c || ')',
    '; '
  ) INTO conflict_count, conflict_detail
  FROM (
    SELECT instituicao_id, email, COUNT(*) AS c
    FROM "users"
    GROUP BY instituicao_id, email
    HAVING COUNT(*) > 1
  ) dup;

  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION ABORT: Existem emails duplicados dentro da mesma instituição. Corrija os dados antes de aplicar. Detalhes: %', conflict_detail;
  END IF;
END $$;

-- 2) Criar nova constraint composta: UNIQUE (instituicao_id, email)
-- NULLS NOT DISTINCT: usuários sem instituição (ex: SUPER_ADMIN) também ficam únicos por email
CREATE UNIQUE INDEX "users_instituicao_id_email_key"
  ON "users" ("instituicao_id", "email") NULLS NOT DISTINCT;

-- 3) Remover constraint antiga (email global)
DROP INDEX IF EXISTS "users_email_key";

-- ROLLBACK (manual, se necessário):
-- DROP INDEX IF EXISTS "users_instituicao_id_email_key";
-- CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
-- Nota: rollback só é possível se não houver pares (instituicao_id, email) duplicados entre instituições.
