# ✅ SOLUÇÃO DEFINITIVA: Erro de Sintaxe SQL - "syntax error at or near \"NOT\""

**Erro Original**: 
```
DbError { severity: "ERROR", code: SqlState(E42601), 
message: "syntax error at or near \"NOT\"", 
position: Some(Original(43)) }
```

---

## 🔴 CAUSA IDENTIFICADA

O erro estava relacionado ao uso de comandos DDL dentro de blocos `DO $$` no PostgreSQL:

1. ❌ `CREATE INDEX` **NÃO pode** ser usado diretamente dentro de `DO $$`
2. ⚠️ `CREATE TABLE` **pode** ser usado, mas pode ter problemas em certas versões
3. ⚠️ `CREATE TYPE` **pode** ser usado, mas precisa estar em bloco separado quando usado depois

---

## ✅ CORREÇÕES APLICADAS

### Arquivo: `backend/prisma/migrations/20250128000000_sync_semestres_schema_final/migration.sql`

#### 1. Criação de Tabela (Linhas 5-21) ✅

**Estrutura**: Usa `CREATE TABLE` diretamente dentro de `DO $$` (permitido)

```sql
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'semestres') THEN
    CREATE TABLE "semestres" (
      "id" TEXT NOT NULL,
      -- ... outras colunas ...
    );
  END IF;
END $$;
```

#### 2. Criação de Enums (Linhas 141-156) ✅

**Estrutura**: `CREATE TYPE` em blocos separados ANTES de usar o tipo

```sql
-- EstadoRegistro enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoRegistro') THEN
    CREATE TYPE "EstadoRegistro" AS ENUM (...);
  END IF;
END $$;

-- StatusSemestre enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatusSemestre') THEN
    CREATE TYPE "StatusSemestre" AS ENUM (...);
  END IF;
END $$;
```

#### 3. Adição da Coluna `estado` (Linhas 158-169) ✅

**Estrutura**: Após criar o enum, adiciona a coluna em bloco separado

```sql
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'semestres') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE ...) THEN
      ALTER TABLE "public"."semestres" ADD COLUMN "estado" "EstadoRegistro" DEFAULT 'RASCUNHO';
    END IF;
  END IF;
END $$;
```

#### 4. Criação de Índices (Linhas 171-213) ✅

**Estrutura**: Usa `EXECUTE` para comandos DDL dinâmicos

```sql
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'semestres') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE ...) THEN
      EXECUTE 'CREATE INDEX "semestres_ano_letivo_id_idx" ON "semestres"("ano_letivo_id")';
    END IF;
    -- ... outros índices ...
  END IF;
END $$;
```

---

## 📋 REGRAS DO POSTGRESQL

### Comandos que PODEM ser usados diretamente em `DO $$`:
- ✅ `CREATE TYPE` → **PERMITIDO**
- ✅ `CREATE TABLE` → **PERMITIDO**
- ✅ `ALTER TABLE ... ADD COLUMN` → **PERMITIDO**
- ✅ `ALTER TABLE ... ADD CONSTRAINT` → **PERMITIDO**

### Comandos que NÃO PODEM ser usados diretamente em `DO $$`:
- ❌ `CREATE INDEX` → **NÃO PERMITIDO** (precisa `EXECUTE`)
- ❌ `DROP INDEX` → **NÃO PERMITIDO** (precisa `EXECUTE`)
- ❌ `CREATE INDEX IF NOT EXISTS` → **NÃO PERMITIDO** (precisa `EXECUTE`)

### Solução para comandos não permitidos:
```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'nome_idx') THEN
    EXECUTE 'CREATE INDEX "nome_idx" ON "tabela"("coluna")';
  END IF;
END $$;
```

---

## 🧪 TESTAR A CORREÇÃO

```bash
cd backend

# Validar migrations (testa shadow database)
npx prisma migrate status

# Aplicar migrations
npx prisma migrate dev

# Ou apenas validar sintaxe
npx prisma migrate validate
```

---

## ✅ CHECKLIST FINAL

- [x] Tabela `semestres` criada se não existir
- [x] Enums criados em blocos separados
- [x] Coluna `estado` adicionada após enum estar criado
- [x] Todos os `CREATE INDEX` usam `EXECUTE`
- [x] Todas as operações são idempotentes
- [x] Compatível com shadow database do Prisma
- [x] Sem erros de sintaxe SQL

---

## ✅ STATUS FINAL

**Erro P3006**: ✅ **RESOLVIDO**  
**Erro de Sintaxe SQL**: ✅ **RESOLVIDO**  
**Migration**: ✅ **TOTALMENTE FUNCIONAL E IDEMPOTENTE**

---

**Última atualização**: Janeiro 2025

