# ✅ SOLUÇÃO: Erro P3015 - Migration arquivada não encontrada

**Erro**: 
```
Error: P3015
Could not find the migration file at prisma/migrations/_archived_broken_migrations/migration.sql. 
Please delete the directory or restore the migration file.
```

---

## 🔴 CAUSA DO PROBLEMA

O Prisma está procurando uma migration em `_archived_broken_migrations/migration.sql` (sem o nome da migration), mas:
1. ❌ O arquivo não existe nesse caminho exato
2. ❌ O diretório `_archived_broken_migrations` está dentro de `migrations/`, então o Prisma tenta processá-lo
3. ❌ Há uma entrada incorreta na tabela `_prisma_migrations` do banco de dados

---

## ✅ SOLUÇÃO: Remover ou Mover o Diretório Arquivado

O Prisma **não deve processar** diretórios arquivados. A melhor solução é **mover o diretório para fora** da pasta `migrations/`.

### Opção 1: Mover para fora (RECOMENDADO)

```bash
cd backend/prisma
mv migrations/_archived_broken_migrations ./_archived_broken_migrations
```

Isso move para: `backend/prisma/_archived_broken_migrations/` (fora de `migrations/`)

### Opção 2: Remover completamente (se não for mais necessário)

Se você não precisa mais das migrations arquivadas:

```bash
cd backend/prisma/migrations
rm -rf _archived_broken_migrations
```

---

## 🔧 LIMPAR HISTÓRICO DO BANCO (Se necessário)

Se o erro persistir após mover/remover o diretório, pode ser que há uma entrada incorreta na tabela `_prisma_migrations`. 

### Verificar entrada problemática:

```sql
-- Conectar ao banco de dados
SELECT * FROM _prisma_migrations 
WHERE migration_name LIKE '%archived%' 
   OR migration_name LIKE '%20250120000000%';
```

### Remover entrada problemática (se existir):

```sql
-- ATENÇÃO: Apenas se você tiver certeza que a migration não deve estar aplicada
DELETE FROM _prisma_migrations 
WHERE migration_name = '_archived_broken_migrations' 
   OR migration_name LIKE '%20250120000000_create_semestres_table%';
```

---

## 🧪 TESTAR APÓS CORREÇÃO

```bash
cd backend

# 1. Verificar status das migrations
npx prisma migrate status

# 2. Se tudo estiver OK, validar migrations
npx prisma migrate dev

# 3. Se houver problemas, marcar como resolvida (se já aplicada)
npx prisma migrate resolve --applied 20250120000000_create_semestres_table
```

---

## 📋 CHECKLIST DE VERIFICAÇÃO

- [ ] Diretório `_archived_broken_migrations` movido para fora de `migrations/` ou removido
- [ ] Entradas incorretas em `_prisma_migrations` removidas (se necessário)
- [ ] `npx prisma migrate status` funciona sem erro P3015
- [ ] Migrations aplicadas corretamente

---

## ⚠️ IMPORTANTE

O diretório `_archived_broken_migrations` contém migrations que foram **substituídas pelo baseline** `20260202000000_baseline_academic_tables`. Elas não devem ser processadas pelo Prisma, apenas mantidas como histórico/referência.

---

**Última atualização**: Janeiro 2025

