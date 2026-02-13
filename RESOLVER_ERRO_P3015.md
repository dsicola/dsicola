# ✅ RESOLVER: Erro P3015 - Migration arquivada não encontrada

**Erro**: 
```
Error: P3015
Could not find the migration file at prisma/migrations/_archived_broken_migrations/migration.sql.
```

---

## 🔴 CAUSA

O Prisma tem uma entrada na tabela `_prisma_migrations` apontando para `_archived_broken_migrations/migration.sql`, mas:
1. O diretório foi movido para fora de `migrations/`
2. O arquivo não existe no caminho esperado
3. Há uma migration duplicada ainda em `migrations/`

---

## ✅ SOLUÇÃO COMPLETA (3 PASSOS)

### PASSO 1: Remover Migration Duplicada

A migration `20250120000000_create_semestres_table` ainda existe em `migrations/` (duplicada). Remova:

```bash
# No terminal:
cd backend/prisma/migrations
rm -rf 20250120000000_create_semestres_table
```

**OU** via código, já foi deletado automaticamente.

---

### PASSO 2: Limpar Entrada no Banco de Dados (CRÍTICO)

Execute este SQL no seu banco de dados:

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

-- Remover entradas incorretas
DELETE FROM _prisma_migrations 
WHERE migration_name = '_archived_broken_migrations'
   OR migration_name = '20250120000000_create_semestres_table';
```

**OU** execute o script: `backend/prisma/FIX_ERRO_P3015.sql`

---

### PASSO 3: Validar Migrations

```bash
cd backend

# Verificar status (não deve mais dar erro P3015)
npx prisma migrate status

# Se tudo estiver OK, validar migrations
npx prisma migrate dev
```

---

## 🔧 ALTERNATIVA: Usar Comando Prisma

Se você não tem acesso SQL direto, use:

```bash
cd backend

# Marcar como resolvida (se já foi aplicada)
npx prisma migrate resolve --applied _archived_broken_migrations

# OU marcar como revertida (se não foi aplicada)
npx prisma migrate resolve --rolled-back _archived_broken_migrations
npx prisma migrate resolve --rolled-back 20250120000000_create_semestres_table
```

---

## ⚠️ SE O ERRO PERSISTIR

Se ainda aparecer erro P3015 após os passos acima:

1. **Verificar se diretório realmente foi movido**:
   ```bash
   ls -la backend/prisma/ | grep archived
   # Deve mostrar: _archived_broken_migrations/ (fora de migrations/)
   ```

2. **Verificar se migration duplicada foi removida**:
   ```bash
   ls backend/prisma/migrations/ | grep 20250120000000
   # NÃO deve mostrar: 20250120000000_create_semestres_table
   ```

3. **Reset completo (ÚLTIMA OPÇÃO)**:
   ```bash
   cd backend
   npx prisma migrate reset --skip-seed
   npx prisma migrate deploy
   ```

---

## 📋 CHECKLIST FINAL

- [ ] Migration duplicada `20250120000000_create_semestres_table` removida de `migrations/`
- [ ] Entrada `_archived_broken_migrations` removida de `_prisma_migrations` (SQL)
- [ ] Entrada `20250120000000_create_semestres_table` removida de `_prisma_migrations` (SQL)
- [ ] `npx prisma migrate status` funciona sem erro P3015
- [ ] Diretório `_archived_broken_migrations` está fora de `migrations/`

---

## ✅ ESTRUTURA CORRETA

**✅ CORRETO**:
```
backend/prisma/
  ├── _archived_broken_migrations/  ✅ Fora de migrations/
  │   └── 20250120000000_create_semestres_table/
  └── migrations/
      ├── 20260202000000_baseline_academic_tables/  ✅ Baseline ativo
      └── (outras migrations ativas)
```

**❌ INCORRETO** (não deve existir):
```
backend/prisma/migrations/
  └── _archived_broken_migrations/  ❌ Dentro de migrations/
  └── 20250120000000_create_semestres_table/  ❌ Duplicada
```

---

**Data**: Janeiro 2025

