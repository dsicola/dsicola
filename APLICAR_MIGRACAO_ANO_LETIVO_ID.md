# 🔧 INSTRUÇÕES: Aplicar Migração ano_letivo_id

## ❌ Problema Identificado

O banco de dados não possui a coluna `ano_letivo_id` nas tabelas `semestres` e `trimestres`, causando erro:

```
The column `semestres.ano_letivo_id` does not exist in the current database.
```

## ✅ Solução

A migração foi atualizada para ser idempotente (pode ser executada múltiplas vezes sem erro).

### Opção 1: Aplicar via Prisma Migrate (Recomendado)

```bash
cd backend
npx prisma migrate deploy
```

Ou se estiver em desenvolvimento:

```bash
cd backend
npx prisma migrate dev --name add_ano_letivo_id_to_semestres_trimestres
```

### Opção 2: Aplicar SQL Manualmente

Execute o SQL diretamente no banco de dados:

```sql
-- Adicionar coluna ano_letivo_id em semestres (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'semestres' AND column_name = 'ano_letivo_id'
  ) THEN
    ALTER TABLE "semestres" ADD COLUMN "ano_letivo_id" TEXT;
  END IF;
END $$;

-- Adicionar coluna ano_letivo_id em trimestres (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trimestres' AND column_name = 'ano_letivo_id'
  ) THEN
    ALTER TABLE "trimestres" ADD COLUMN "ano_letivo_id" TEXT;
  END IF;
END $$;

-- Criar índices
CREATE INDEX IF NOT EXISTS "semestres_ano_letivo_id_idx" ON "semestres"("ano_letivo_id");
CREATE INDEX IF NOT EXISTS "trimestres_ano_letivo_id_idx" ON "trimestres"("ano_letivo_id");

-- Adicionar foreign keys
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'semestres_ano_letivo_id_fkey'
  ) THEN
    ALTER TABLE "semestres" ADD CONSTRAINT "semestres_ano_letivo_id_fkey" 
      FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") 
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'trimestres_ano_letivo_id_fkey'
  ) THEN
    ALTER TABLE "trimestres" ADD CONSTRAINT "trimestres_ano_letivo_id_fkey" 
      FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") 
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Preencher ano_letivo_id com base no ano_letivo existente
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
```

### Opção 3: Regenerar Prisma Client

Após aplicar a migração, regenere o Prisma Client:

```bash
cd backend
npx prisma generate
```

## ✅ Verificação

Após aplicar a migração, verifique se as colunas foram criadas:

```sql
-- Verificar colunas em semestres
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'semestres' AND column_name = 'ano_letivo_id';

-- Verificar colunas em trimestres
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'trimestres' AND column_name = 'ano_letivo_id';
```

## 🔄 Após Aplicar

1. Reiniciar o servidor backend
2. Testar criação de semestre/trimestre
3. Verificar se o scheduler funciona corretamente

---

**Arquivo de Migração**: `backend/prisma/migrations/20250127120000_add_ano_letivo_id_to_semestres_trimestres/migration.sql`

