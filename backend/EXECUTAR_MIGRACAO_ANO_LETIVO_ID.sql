-- ============================================
-- MIGRAÇÃO: Adicionar ano_letivo_id
-- ============================================
-- Execute este script no banco de dados PostgreSQL
-- 
-- Comando: psql -U seu_usuario -d seu_banco -f EXECUTAR_MIGRACAO_ANO_LETIVO_ID.sql
-- Ou execute via cliente PostgreSQL (pgAdmin, DBeaver, etc.)
-- ============================================

BEGIN;

-- Adicionar coluna ano_letivo_id em semestres
ALTER TABLE "semestres" ADD COLUMN IF NOT EXISTS "ano_letivo_id" TEXT;

-- Adicionar coluna ano_letivo_id em trimestres
ALTER TABLE "trimestres" ADD COLUMN IF NOT EXISTS "ano_letivo_id" TEXT;

-- Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS "semestres_ano_letivo_id_idx" ON "semestres"("ano_letivo_id");
CREATE INDEX IF NOT EXISTS "trimestres_ano_letivo_id_idx" ON "trimestres"("ano_letivo_id");

-- Adicionar foreign keys (se a tabela anos_letivos existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'anos_letivos') THEN
    -- Remover constraint se já existir
    ALTER TABLE "semestres" DROP CONSTRAINT IF EXISTS "semestres_ano_letivo_id_fkey";
    ALTER TABLE "trimestres" DROP CONSTRAINT IF EXISTS "trimestres_ano_letivo_id_fkey";
    
    -- Adicionar foreign keys
    ALTER TABLE "semestres" ADD CONSTRAINT "semestres_ano_letivo_id_fkey" 
      FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") 
      ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "trimestres" ADD CONSTRAINT "trimestres_ano_letivo_id_fkey" 
      FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") 
      ON DELETE CASCADE ON UPDATE CASCADE;

    -- Preencher ano_letivo_id com base no ano_letivo (número) existente
    UPDATE "semestres" s
    SET "ano_letivo_id" = al.id
    FROM "anos_letivos" al
    WHERE s."ano_letivo" = al."ano" 
      AND (s."instituicao_id" = al."instituicao_id" OR (s."instituicao_id" IS NULL AND al."instituicao_id" IS NULL))
      AND s."ano_letivo_id" IS NULL;

    UPDATE "trimestres" t
    SET "ano_letivo_id" = al.id
    FROM "anos_letivos" al
    WHERE t."ano_letivo" = al."ano" 
      AND (t."instituicao_id" = al."instituicao_id" OR (t."instituicao_id" IS NULL AND al."instituicao_id" IS NULL))
      AND t."ano_letivo_id" IS NULL;
  ELSE
    RAISE NOTICE 'Tabela anos_letivos não existe. Pulando criação de foreign keys.';
  END IF;
END $$;

COMMIT;

-- Verificar se as colunas foram criadas
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'semestres' AND column_name = 'ano_letivo_id'
UNION ALL
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'trimestres' AND column_name = 'ano_letivo_id';

