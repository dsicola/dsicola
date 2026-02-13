# ⚡ SOLUÇÃO RÁPIDA: Erro `ano_letivo_id` não existe

## 🔴 Problema

```
The column `semestres.ano_letivo_id` does not exist in the current database.
```

O Prisma Client está tentando usar uma coluna que não existe no banco.

## ✅ Solução Imediata

### Passo 1: Executar a Migração SQL

Execute este SQL no seu banco PostgreSQL:

```sql
-- Adicionar coluna ano_letivo_id
ALTER TABLE "semestres" ADD COLUMN IF NOT EXISTS "ano_letivo_id" TEXT;
ALTER TABLE "trimestres" ADD COLUMN IF NOT EXISTS "ano_letivo_id" TEXT;

-- Criar índices
CREATE INDEX IF NOT EXISTS "semestres_ano_letivo_id_idx" ON "semestres"("ano_letivo_id");
CREATE INDEX IF NOT EXISTS "trimestres_ano_letivo_id_idx" ON "trimestres"("ano_letivo_id");

-- Adicionar foreign keys (se tabela anos_letivos existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'anos_letivos') THEN
    ALTER TABLE "semestres" DROP CONSTRAINT IF EXISTS "semestres_ano_letivo_id_fkey";
    ALTER TABLE "trimestres" DROP CONSTRAINT IF EXISTS "trimestres_ano_letivo_id_fkey";
    
    ALTER TABLE "semestres" ADD CONSTRAINT "semestres_ano_letivo_id_fkey" 
      FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") 
      ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "trimestres" ADD CONSTRAINT "trimestres_ano_letivo_id_fkey" 
      FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") 
      ON DELETE CASCADE ON UPDATE CASCADE;

    -- Preencher dados existentes
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
  END IF;
END $$;
```

### Passo 2: Regenerar Prisma Client

```bash
cd backend
npx prisma generate
```

### Passo 3: Reiniciar o Servidor

```bash
# Pare o servidor (Ctrl+C) e inicie novamente
npm run dev
```

## 📋 Arquivos Criados

1. ✅ **Migração SQL**: `backend/prisma/migrations/20250127120000_add_ano_letivo_id_to_semestres_trimestres/migration.sql`
2. ✅ **Script SQL Manual**: `backend/EXECUTAR_MIGRACAO_ANO_LETIVO_ID.sql`
3. ✅ **Instruções**: `INSTRUCOES_CORRECAO_ANO_LETIVO_ID.md`

## ✅ Após Executar

O erro deve desaparecer e você poderá criar semestres/trimestres normalmente.

---

**Status**: 🟢 **CORREÇÃO PRONTA PARA APLICAR**

