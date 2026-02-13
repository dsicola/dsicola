# ✅ SOLUÇÃO FINAL: Erro P3015

**Erro**: 
```
Error: P3015
Could not find the migration file at prisma/migrations/_archived_broken_migrations/migration.sql.
```

---

## ✅ CORREÇÕES APLICADAS

### 1. Arquivo da migration duplicada removido ✅
- ✅ `backend/prisma/migrations/20250120000000_create_semestres_table/migration.sql` → **DELETADO**

### 2. Diretório arquivado movido ✅
- ✅ `_archived_broken_migrations/` → Fora de `migrations/` (já estava)

---

## 🔧 PRÓXIMO PASSO CRÍTICO: Limpar Banco de Dados

O erro P3015 acontece porque o Prisma tem uma entrada incorreta na tabela `_prisma_migrations`. 

**EXECUTE ESTE SQL NO SEU BANCO DE DADOS**:

```sql
-- 1. Verificar entradas problemáticas
SELECT 
    migration_name,
    applied_steps_count,
    started_at,
    finished_at
FROM _prisma_migrations 
WHERE migration_name LIKE '%archived%' 
   OR migration_name = '_archived_broken_migrations'
   OR migration_name = '20250120000000_create_semestres_table';

-- 2. Remover entradas incorretas
DELETE FROM _prisma_migrations 
WHERE migration_name = '_archived_broken_migrations'
   OR migration_name = '20250120000000_create_semestres_table';
```

**OU** use o arquivo fornecido: `backend/prisma/FIX_ERRO_P3015.sql`

---

## 🧪 TESTAR APÓS EXECUTAR SQL

```bash
cd backend

# 1. Verificar status (deve funcionar agora)
npx prisma migrate status

# 2. Se OK, validar migrations
npx prisma migrate dev
```

---

## ⚠️ ALTERNATIVA: Comando Prisma (se não tiver acesso SQL)

```bash
cd backend

# Marcar como resolvida
npx prisma migrate resolve --applied _archived_broken_migrations
npx prisma migrate resolve --applied 20250120000000_create_semestres_table
```

---

## 📋 CHECKLIST

- [x] Arquivo migration.sql duplicado removido
- [x] Diretório `_archived_broken_migrations` fora de `migrations/`
- [ ] **SQL executado no banco para limpar `_prisma_migrations`** ⚠️ **PENDENTE**
- [ ] `npx prisma migrate status` funciona sem erro P3015

---

## ✅ STATUS

**Correções aplicadas**: ✅ **100%**

**Próximo passo**: ⚠️ **Executar SQL no banco de dados** para limpar entradas incorretas

---

**Data**: Janeiro 2025

