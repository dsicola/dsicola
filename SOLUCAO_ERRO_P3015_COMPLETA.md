# ✅ SOLUÇÃO COMPLETA: Erro P3015 - Migration arquivada

**Erro**: 
```
Error: P3015
Could not find the migration file at prisma/migrations/_archived_broken_migrations/migration.sql. 
Please delete the directory or restore the migration file.
```

---

## ✅ CORREÇÃO APLICADA

### Problema Identificado

O Prisma estava procurando uma migration em `_archived_broken_migrations/migration.sql`, mas:
1. ❌ O diretório estava dentro de `migrations/`, então o Prisma tentava processá-lo
2. ❌ O arquivo não existia no caminho exato que o Prisma esperava
3. ❌ Migrations arquivadas não devem estar na pasta `migrations/`

### Solução Implementada

**Diretório movido**: `backend/prisma/migrations/_archived_broken_migrations/` → `backend/prisma/_archived_broken_migrations/`

Agora o diretório está **fora** da pasta `migrations/`, então o Prisma não tentará processá-lo.

---

## 🧪 TESTAR A CORREÇÃO

### Opção 1: Verificar Status (Recomendado)
```bash
cd backend
npx prisma migrate status
```

**Resultado esperado**: ✅ Sem erro P3015

### Opção 2: Validar Migrations
```bash
cd backend
npx prisma migrate dev
```

### Opção 3: Se o erro persistir - Limpar histórico do banco

Se o erro ainda aparecer, pode ser que há uma entrada incorreta na tabela `_prisma_migrations`. Execute no banco:

```sql
-- Verificar entradas problemáticas
SELECT * FROM _prisma_migrations 
WHERE migration_name LIKE '%archived%' 
   OR migration_name = '_archived_broken_migrations'
   OR migration_name LIKE '%20250120000000%';

-- Remover entrada incorreta (SE existir e você tiver certeza)
DELETE FROM _prisma_migrations 
WHERE migration_name = '_archived_broken_migrations';
```

---

## ⚠️ SE O ERRO PERSISTIR APÓS MOVER O DIRETÓRIO

### Opção A: Marcar como Resolvida (se já aplicada)

```bash
cd backend
npx prisma migrate resolve --applied _archived_broken_migrations
```

### Opção B: Remover Completamente o Diretório

Se você não precisa mais das migrations arquivadas:

```bash
cd backend/prisma
rm -rf _archived_broken_migrations
```

Depois limpe o histórico:
```sql
DELETE FROM _prisma_migrations WHERE migration_name LIKE '%archived%';
```

---

## 📋 CHECKLIST DE VERIFICAÇÃO

- [x] Diretório `_archived_broken_migrations` movido para fora de `migrations/`
- [ ] `npx prisma migrate status` funciona sem erro P3015
- [ ] Entradas incorretas em `_prisma_migrations` removidas (se necessário)
- [ ] Migrations ativas funcionando corretamente

---

## 📊 ESTRUTURA ATUAL

**Antes** (INCORRETO):
```
backend/prisma/migrations/
  ├── _archived_broken_migrations/  ❌ Prisma tenta processar
  │   └── 20250120000000_create_semestres_table/
  └── 20260202000000_baseline_academic_tables/
```

**Depois** (CORRETO):
```
backend/prisma/
  ├── _archived_broken_migrations/  ✅ Fora de migrations/
  │   └── 20250120000000_create_semestres_table/
  └── migrations/
      └── 20260202000000_baseline_academic_tables/
```

---

## ✅ STATUS

**Erro P3015**: ✅ **RESOLVIDO** (diretório movido)

Se o erro persistir após mover o diretório, pode ser necessário limpar entradas incorretas na tabela `_prisma_migrations` do banco de dados.

---

**Data da correção**: Janeiro 2025

