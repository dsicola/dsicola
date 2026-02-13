# 🔧 Solução: Erro P3006 - Shadow Database (Migration Turmas)

## ❌ Problema

Ao executar `npx prisma migrate dev` após aplicar a migration de turmas com `migrate deploy`:

```
Error: P3006
Migration `20250127000000_add_missing_academic_relations` failed to apply cleanly to the shadow database. 
Error code: P1014
The underlying table for model `public.matriculas_anuais` does not exist.
```

## 🔍 Causa

A migration `20250127000000_add_missing_academic_relations` tenta criar índices na tabela `matriculas_anuais` antes dela ser criada. A tabela `matriculas_anuais` é criada na migration `20260101000134_init_academic_modules`, que é **posterior** cronologicamente.

O Prisma tenta aplicar todas as migrações em ordem cronológica no shadow database, e quando chega na `20250127000000`, a tabela ainda não existe.

**Problema específico**: Os `CREATE INDEX` nas linhas 236-243 não estavam dentro de blocos `DO $$` que verificam se a tabela existe.

## ✅ Solução Aplicada

A migration `20250127000000_add_missing_academic_relations` foi corrigida para:

1. ✅ **Verificar se a tabela existe** antes de criar qualquer índice
2. ✅ **Verificar se o índice já existe** antes de criá-lo
3. ✅ **Tornar todas as operações condicionais** à existência da tabela
4. ✅ **Usar blocos `DO $$`** para todas as operações de índice

## 🚀 Como Resolver

### Opção 1: A Migration Já Foi Corrigida (Recomendado)

A migration já foi atualizada. Agora você pode:

```bash
cd backend

# Tentar novamente
npx prisma migrate dev
```

### Opção 2: Usar db push (Desenvolvimento)

Se o problema persistir, use `db push` para desenvolvimento:

```bash
cd backend

# Em vez de migrate dev, use:
npx prisma db push
npx prisma generate
```

**⚠️ NOTA**: `db push` não cria migrations, apenas sincroniza o schema com o banco.

### Opção 3: Desabilitar Shadow Database (Temporário)

Se você precisa usar `migrate dev` e o problema persistir:

```bash
# No arquivo backend/.env, adicione:
PRISMA_MIGRATE_SKIP_GENERATE=1
```

E use uma variável de ambiente para desabilitar shadow database:

```bash
export PRISMA_MIGRATE_SKIP_GENERATE=1
npx prisma migrate dev
```

### Opção 4: Usar migrate deploy (Produção)

Para produção, continue usando `migrate deploy` que não cria shadow database:

```bash
npx prisma migrate deploy
```

---

## 📋 Verificação

Para verificar se a migration está corrigida:

```bash
cd backend

# Verificar status das migrations
npx prisma migrate status

# Se tudo estiver OK, você verá:
# ✅ All migrations have been successfully applied
```

---

## ⚠️ Importante

- ✅ A migration `20250127000000` já foi corrigida
- ✅ A migration `20260131000000_add_ano_letivo_id_to_turmas` já foi aplicada com sucesso
- ⚠️ O problema era apenas com a shadow database durante `migrate dev`
- ✅ Para produção, continue usando `migrate deploy` que funciona normalmente

---

**Última atualização**: Janeiro 2025

