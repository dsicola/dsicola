-- Alterar enum PautaStatus: RASCUNHO | PROVISORIA | DEFINITIVA → RASCUNHO | SUBMETIDA | APROVADA | FECHADA
-- Migração segura: criar novo tipo, migrar dados, substituir

CREATE TYPE "PautaStatus_new" AS ENUM ('RASCUNHO', 'SUBMETIDA', 'APROVADA', 'FECHADA');

ALTER TABLE "plano_ensino" ADD COLUMN "pauta_status_new" "PautaStatus_new" DEFAULT 'RASCUNHO';

UPDATE "plano_ensino" SET "pauta_status_new" = CASE
  WHEN "pauta_status"::text = 'RASCUNHO' THEN 'RASCUNHO'::"PautaStatus_new"
  WHEN "pauta_status"::text = 'PROVISORIA' THEN 'SUBMETIDA'::"PautaStatus_new"
  WHEN "pauta_status"::text = 'DEFINITIVA' THEN 'FECHADA'::"PautaStatus_new"
  ELSE 'RASCUNHO'::"PautaStatus_new"
END;

ALTER TABLE "plano_ensino" DROP COLUMN "pauta_status";
ALTER TABLE "plano_ensino" RENAME COLUMN "pauta_status_new" TO "pauta_status";
ALTER TABLE "plano_ensino" ALTER COLUMN "pauta_status" SET DEFAULT 'RASCUNHO';

DROP TYPE "PautaStatus";
ALTER TYPE "PautaStatus_new" RENAME TO "PautaStatus";
