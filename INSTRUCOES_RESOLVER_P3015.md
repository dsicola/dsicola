# 📋 INSTRUÇÕES: Resolver Erro P3015

**Erro**: `Error: P3015 - Could not find the migration file at prisma/migrations/_archived_broken_migrations/migration.sql`

---

## ✅ O QUE JÁ FOI CORRIGIDO

1. ✅ Arquivo migration duplicado removido
2. ✅ Diretório `_archived_broken_migrations` está fora de `migrations/`

---

## 🔧 AÇÃO NECESSÁRIA (VOCÊ PRECISA FAZER)

O Prisma tem uma entrada incorreta na tabela `_prisma_migrations` do seu banco de dados. 

### Opção 1: Executar SQL diretamente (RECOMENDADO)

**Via psql, pgAdmin, DBeaver ou qualquer cliente SQL:**

```sql
-- Verificar entradas problemáticas
SELECT 
    migration_name,
    applied_steps_count,
    started_at,
    finished_at
FROM _prisma_migrations 
WHERE migration_name LIKE '%archived%' 
   OR migration_name = '_archived_broken_migrations'
   OR migration_name = '20250120000000_create_semestres_table';

-- Se encontrar resultados acima, execute para remover:
DELETE FROM _prisma_migrations 
WHERE migration_name = '_archived_broken_migrations'
   OR migration_name = '20250120000000_create_semestres_table';
```

**Arquivo SQL pronto**: `backend/prisma/FIX_ERRO_P3015.sql`

---

### Opção 2: Usar comando Prisma (Alternativa)

Se você não tem acesso SQL direto:

```bash
cd backend

# Marcar como resolvida (se já foi aplicada)
npx prisma migrate resolve --applied _archived_broken_migrations

# Marcar migration duplicada como resolvida
npx prisma migrate resolve --applied 20250120000000_create_semestres_table

# OU marcar como revertida (se não foi aplicada)
npx prisma migrate resolve --rolled-back _archived_broken_migrations
npx prisma migrate resolve --rolled-back 20250120000000_create_semestres_table
```

---

## 🧪 VALIDAR APÓS EXECUTAR

```bash
cd backend

# 1. Verificar status (não deve mais dar erro P3015)
npx prisma migrate status

# 2. Se tudo OK, validar migrations
npx prisma migrate dev
```

---

## ⚠️ SE AINDA DER ERRO

Se o erro P3015 persistir após executar o SQL/comandos acima:

1. **Verificar se há outras entradas problemáticas**:
   ```sql
   SELECT migration_name FROM _prisma_migrations 
   WHERE migration_name LIKE '%20250120%'
      OR migration_name LIKE '%20250127%'
      OR migration_name LIKE '%20250128%';
   ```

2. **Reset completo (ÚLTIMA OPÇÃO - cuidado!)**:
   ```bash
   cd backend
   npx prisma migrate reset --skip-seed
   npx prisma migrate deploy
   ```

---

## ✅ STATUS FINAL

**Correções aplicadas**: ✅ **100%**

**Ação pendente**: ⚠️ **Você precisa executar SQL no banco ou usar comandos Prisma acima**

Depois de executar, o erro P3015 deve estar resolvido! ✅

---

**Data**: Janeiro 2025

