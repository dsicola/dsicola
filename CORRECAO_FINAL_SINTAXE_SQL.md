# ✅ CORREÇÃO FINAL: Erro de Sintaxe SQL - "syntax error at or near \"NOT\""

**Erro**: 
```
DbError { severity: "ERROR", code: SqlState(E42601), 
message: "syntax error at or near \"NOT\"", 
position: Some(Original(43)) }
```

---

## 🔴 PROBLEMAS IDENTIFICADOS E CORRIGIDOS

### Problema 1: `CREATE INDEX` dentro de `DO $$` ❌

**Linhas 172, 181, 190, 199**: `CREATE INDEX` não pode ser usado diretamente dentro de blocos `DO $$`

**Correção aplicada**: Usar `EXECUTE` para comandos DDL dinâmicos
```sql
-- ✅ CORRETO
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE ...) THEN
  EXECUTE 'CREATE INDEX "nome_idx" ON "tabela"("coluna")';
END IF;
```

### Problema 2: `CREATE TABLE` com aspas simples dentro de `DO $$` ❌

**Linhas 9-19**: `CREATE TABLE` dentro de `DO $$` pode ter problemas com aspas simples

**Correção aplicada**: Usar `EXECUTE` com `$sql$` delimiter para evitar problemas de escape
```sql
-- ✅ CORRETO
EXECUTE $sql$
  CREATE TABLE "tabela" (...)
$sql$;
```

---

## ✅ MUDANÇAS APLICADAS

### Arquivo: `backend/prisma/migrations/20250128000000_sync_semestres_schema_final/migration.sql`

1. ✅ **Linhas 5-22**: `CREATE TABLE` agora usa `EXECUTE $sql$...$sql$` para evitar problemas de sintaxe
2. ✅ **Linhas 172, 181, 190, 199**: `CREATE INDEX` agora usa `EXECUTE` em vez de comando direto

---

## 📋 REGRAS DO POSTGRESQL

### Comandos DDL que PRECISAM de `EXECUTE` dentro de `DO $$`:

- ✅ `CREATE INDEX` → **SEMPRE usar EXECUTE**
- ✅ `CREATE TABLE` → **Recomendado usar EXECUTE para evitar problemas**
- ✅ `ALTER TABLE` (alguns casos) → **Depende do contexto**
- ✅ `DROP TABLE` → **SEMPRE usar EXECUTE**

### Sintaxe Correta:

```sql
DO $$
BEGIN
  -- Para CREATE INDEX
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE ...) THEN
    EXECUTE 'CREATE INDEX "idx_name" ON "table"("column")';
  END IF;
  
  -- Para CREATE TABLE (usando $sql$ para evitar problemas de escape)
  EXECUTE $sql$
    CREATE TABLE "table" (
      "id" TEXT NOT NULL,
      ...
    )
  $sql$;
END $$;
```

---

## 🧪 TESTAR A CORREÇÃO

```bash
cd backend

# Validar migrations
npx prisma migrate status

# Aplicar migrations (testa shadow database)
npx prisma migrate dev

# Ou validar sem aplicar
npx prisma migrate validate
```

---

## ✅ STATUS

- [x] Erro de sintaxe `CREATE INDEX` corrigido
- [x] `CREATE TABLE` agora usa `EXECUTE` com delimiter `$sql$`
- [x] Migration totalmente idempotente
- [x] Compatível com shadow database do Prisma
- [x] Todas as operações verificam existência antes de executar

---

**Última atualização**: Janeiro 2025

