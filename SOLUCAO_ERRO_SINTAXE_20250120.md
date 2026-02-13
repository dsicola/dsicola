# 🔴 SOLUÇÃO: Erro de Sintaxe na Migration `20250120000000_create_semestres_table`

**Erro**: 
```
Error: P3006
Migration `20250120000000_create_semestres_table` failed to apply cleanly to the shadow database.
Error: syntax error at or near "NOT"
```

---

## 🔍 ANÁLISE DO PROBLEMA

O erro `syntax error at or near "NOT"` pode ocorrer por várias razões:

1. **Enum não reconhecido**: Os enums criados em blocos `DO $$` podem não estar disponíveis quando o `CREATE TABLE` tenta usá-los
2. **Problema com DEFAULT**: `DEFAULT 'PLANEJADO'` pode ter problema de sintaxe
3. **Conflito de versão PostgreSQL**: Versões antigas podem não suportar algumas construções

---

## ✅ CORREÇÕES APLICADAS

### 1. Enums Criados com Tratamento de Erro ✅

✅ **Implementado**: Enums criados em blocos separados com `EXCEPTION WHEN duplicate_object`

### 2. updated_at Corrigido ✅

✅ **Removido**: `DEFAULT CURRENT_TIMESTAMP` do `updated_at` (Prisma usa `@updatedAt`)

---

## 🚨 SE O ERRO PERSISTIR - SOLUÇÃO ALTERNATIVA

Se o erro continuar, a causa mais provável é que a migration já foi aplicada no banco principal, mas está falhando no shadow database. 

### Opção 1: Marcar como Resolvida (Recomendado)

Se a migration já foi aplicada no banco principal:

```bash
cd backend
npx prisma migrate resolve --applied 20250120000000_create_semestres_table
```

### Opção 2: Verificar se Tabelas Já Existem

```sql
-- Verificar se tabelas já existem
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('anos_letivos', 'semestres');
```

Se existirem, marque a migration como resolvida (Opção 1).

### Opção 3: Criar Migration Corrigida

Se a migration nunca foi aplicada, podemos criar uma nova versão corrigida:

1. **Arquivar migration problemática**:
```bash
mkdir -p backend/prisma/migrations/_archived_broken_migrations
mv backend/prisma/migrations/20250120000000_create_semestres_table \
   backend/prisma/migrations/_archived_broken_migrations/
```

2. **Criar nova migration limpa**:
```bash
cd backend
npx prisma migrate dev --name create_semestres_table_fixed --create-only
```

3. **Editar a nova migration** com SQL limpo e idempotente.

---

## ⚠️ PROBLEMA CONHECIDO: Shadow Database

O Prisma usa um **shadow database** temporário para validar migrations. Esse banco é criado do zero, então todas as migrations precisam funcionar em sequência.

**Se a migration já foi aplicada no banco principal**, o shadow database ainda tenta executá-la e pode falhar por:
- Dependências de outras migrations já aplicadas
- Dados existentes que afetam a validação
- Conflitos de versão do PostgreSQL

**Solução**: Marcar como resolvida se já aplicada.

---

## ✅ CHECKLIST DE VERIFICAÇÃO

- [ ] Verificar se tabelas `anos_letivos` e `semestres` já existem no banco
- [ ] Se existirem → Marcar migration como resolvida
- [ ] Se não existirem → Verificar sintaxe SQL
- [ ] Verificar versão do PostgreSQL
- [ ] Testar SQL diretamente no banco antes de usar Prisma

---

## 📋 SQL PARA TESTAR DIRETAMENTE

```sql
-- Testar criação dos enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatusAnoLetivo') THEN
    CREATE TYPE "StatusAnoLetivo" AS ENUM ('PLANEJADO', 'ATIVO', 'ENCERRADO');
  END IF;
END $$;

-- Testar criação da tabela
CREATE TABLE IF NOT EXISTS "anos_letivos" (
    "id" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "status" "StatusAnoLetivo" NOT NULL DEFAULT 'PLANEJADO',
    CONSTRAINT "anos_letivos_pkey" PRIMARY KEY ("id")
);
```

Se esse SQL funcionar diretamente no banco, o problema é com o shadow database do Prisma.

---

**Última atualização**: Janeiro 2025

