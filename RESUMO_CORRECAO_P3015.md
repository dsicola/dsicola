# ✅ RESUMO: Correção Erro P3015

**Erro**: `Error: P3015 - Could not find the migration file at prisma/migrations/_archived_broken_migrations/migration.sql`

---

## ✅ CORREÇÕES APLICADAS

1. ✅ Arquivo `migration.sql` duplicado deletado
2. ✅ Diretório `20250120000000_create_semestres_table` vazio removido (se ainda existir)
3. ✅ Diretório `_archived_broken_migrations` está fora de `migrations/`
4. ✅ Script SQL criado: `backend/prisma/FIX_ERRO_P3015.sql`

---

## ⚠️ AÇÃO NECESSÁRIA - EXECUTAR AGORA

O erro persiste porque há uma **entrada incorreta na tabela `_prisma_migrations` do banco de dados**. 

### SOLUÇÃO 1: Executar SQL (RECOMENDADO)

Execute este SQL no seu banco de dados:

```sql
-- Verificar e remover entradas problemáticas
DELETE FROM _prisma_migrations 
WHERE migration_name = '_archived_broken_migrations'
   OR migration_name = '20250120000000_create_semestres_table';
```

**Arquivo pronto**: `backend/prisma/FIX_ERRO_P3015.sql`

### SOLUÇÃO 2: Comando Prisma (Alternativa)

```bash
cd backend
npx prisma migrate resolve --applied _archived_broken_migrations
npx prisma migrate resolve --applied 20250120000000_create_semestres_table
```

---

## 🧪 VALIDAR

```bash
cd backend
npx prisma migrate status  # Não deve mais dar erro P3015
```

---

## 📋 CHECKLIST

- [x] Arquivo migration.sql removido
- [x] Diretório vazio removido
- [x] Diretório arquivado movido
- [ ] **SQL executado no banco** ⚠️ **PENDENTE - VOCÊ PRECISA FAZER**

---

**Status**: Correções aplicadas, falta apenas executar SQL no banco.

**Data**: Janeiro 2025

