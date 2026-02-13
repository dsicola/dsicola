# ✅ SOLUÇÃO DEFINITIVA: Erro P3015

**Erro**: 
```
Error: P3015
Could not find the migration file at prisma/migrations/_archived_broken_migrations/migration.sql. 
Please delete the directory or restore the migration file.
```

---

## 🔴 CAUSA DO PROBLEMA

O Prisma tem uma entrada na tabela `_prisma_migrations` do banco de dados apontando para `_archived_broken_migrations/migration.sql`, mas:
1. ❌ O diretório foi movido para fora de `migrations/`
2. ❌ O arquivo não existe no caminho esperado
3. ❌ Há uma entrada incorreta no histórico do Prisma

---

## ✅ SOLUÇÕES (em ordem de prioridade)

### SOLUÇÃO 1: Limpar entrada no banco de dados (RECOMENDADO)

Execute este SQL no seu banco de dados:

```sql
-- Verificar entradas problemáticas
SELECT * FROM _prisma_migrations 
WHERE migration_name LIKE '%archived%' 
   OR migration_name = '_archived_broken_migrations'
   OR migration_name LIKE '%20250120000000_create_semestres_table%';

-- Remover entrada incorreta
DELETE FROM _prisma_migrations 
WHERE migration_name = '_archived_broken_migrations'
   OR migration_name = '20250120000000_create_semestres_table';
```

**OU** use o script fornecido: `backend/prisma/FIX_ERRO_P3015.sql`

---

### SOLUÇÃO 2: Usar comando Prisma (Alternativa)

```bash
cd backend

# Marcar como resolvida (se já foi aplicada)
npx prisma migrate resolve --applied _archived_broken_migrations

# OU marcar como revertida (se não foi aplicada)
npx prisma migrate resolve --rolled-back _archived_broken_migrations
```

---

### SOLUÇÃO 3: Remover migration duplicada

Ainda existe `20250120000000_create_semestres_table` dentro de `migrations/` (duplicada). Remova:

```bash
cd backend/prisma/migrations
rm -rf 20250120000000_create_semestres_table
```

Depois limpe o histórico:
```sql
DELETE FROM _prisma_migrations WHERE migration_name = '20250120000000_create_semestres_table';
```

---

## 🧪 TESTAR APÓS CORREÇÃO

```bash
cd backend

# 1. Verificar status
npx prisma migrate status

# 2. Se OK, validar migrations
npx prisma migrate dev

# 3. Se houver outros problemas, verificar
npx prisma migrate resolve --help
```

---

## 📋 CHECKLIST

- [x] Diretório `_archived_broken_migrations` movido para fora de `migrations/`
- [ ] Entrada incorreta em `_prisma_migrations` removida (SQL acima)
- [ ] Migration duplicada `20250120000000_create_semestres_table` removida de `migrations/`
- [ ] `npx prisma migrate status` funciona sem erro P3015

---

## ⚠️ IMPORTANTE

O erro P3015 acontece porque o Prisma está procurando uma migration que foi arquivada. A solução é **limpar a entrada do banco de dados**, não restaurar o arquivo (que foi arquivado intencionalmente).

---

**Data**: Janeiro 2025

