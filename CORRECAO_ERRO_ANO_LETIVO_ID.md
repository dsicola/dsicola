# 🔧 CORREÇÃO: Erro "ano_letivo_id does not exist"

## ❌ Problema

O erro ocorre porque:
1. O **schema Prisma** define `anoLetivoId` (mapeado para `ano_letivo_id`)
2. O **Prisma Client** foi gerado com base nesse schema
3. Mas o **banco de dados** não possui a coluna `ano_letivo_id` ainda
4. Quando o Prisma tenta fazer queries, ele tenta selecionar essa coluna e falha

**Erro**:
```
The column `semestres.ano_letivo_id` does not exist in the current database.
```

## ✅ Solução

### **OPÇÃO 1: Aplicar Migração via Prisma (Recomendado)**

```bash
cd backend
npx prisma migrate deploy
```

Se estiver em desenvolvimento:
```bash
cd backend
npx prisma migrate dev
```

### **OPÇÃO 2: Executar SQL Manualmente (Mais Rápido)**

Execute o arquivo SQL diretamente no seu banco PostgreSQL:

**Arquivo**: `backend/scripts/fix_ano_letivo_id.sql`

Ou execute este SQL diretamente:

```sql
-- Adicionar coluna ano_letivo_id em semestres
ALTER TABLE "semestres" ADD COLUMN IF NOT EXISTS "ano_letivo_id" TEXT;

-- Adicionar coluna ano_letivo_id em trimestres
ALTER TABLE "trimestres" ADD COLUMN IF NOT EXISTS "ano_letivo_id" TEXT;

-- Criar índices
CREATE INDEX IF NOT EXISTS "semestres_ano_letivo_id_idx" ON "semestres"("ano_letivo_id");
CREATE INDEX IF NOT EXISTS "trimestres_ano_letivo_id_idx" ON "trimestres"("ano_letivo_id");

-- Adicionar foreign keys (remover constraint antiga se existir)
ALTER TABLE "semestres" DROP CONSTRAINT IF EXISTS "semestres_ano_letivo_id_fkey";
ALTER TABLE "semestres" ADD CONSTRAINT "semestres_ano_letivo_id_fkey" 
  FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") 
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "trimestres" DROP CONSTRAINT IF EXISTS "trimestres_ano_letivo_id_fkey";
ALTER TABLE "trimestres" ADD CONSTRAINT "trimestres_ano_letivo_id_fkey" 
  FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") 
  ON DELETE CASCADE ON UPDATE CASCADE;

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

### **OPÇÃO 3: Via psql (PostgreSQL CLI)**

```bash
psql -U seu_usuario -d seu_banco -f backend/scripts/fix_ano_letivo_id.sql
```

## ✅ Após Aplicar a Migração

1. **Regenerar Prisma Client** (importante!):
```bash
cd backend
npx prisma generate
```

2. **Reiniciar o servidor backend**

3. **Testar criação de semestre/trimestre**

## 🔍 Verificação

Após aplicar, verifique se as colunas foram criadas:

```sql
-- Verificar colunas
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('semestres', 'trimestres') 
  AND column_name = 'ano_letivo_id';

-- Verificar se há registros sem ano_letivo_id
SELECT 
  'semestres' as tabela,
  COUNT(*) as total,
  COUNT("ano_letivo_id") as com_ano_letivo_id
FROM "semestres"
UNION ALL
SELECT 
  'trimestres' as tabela,
  COUNT(*) as total,
  COUNT("ano_letivo_id") as com_ano_letivo_id
FROM "trimestres";
```

## ⚠️ Importante

- A migração preenche automaticamente `ano_letivo_id` para registros existentes
- Novos semestres/trimestres já serão criados com `ano_letivo_id` preenchido
- O scheduler funcionará corretamente após aplicar a migração

---

**Status**: ✅ Script SQL criado e pronto para execução  
**Arquivo**: `backend/scripts/fix_ano_letivo_id.sql`
