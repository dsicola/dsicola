# ✅ CORREÇÃO: Erro de Sintaxe na Migration `20250120000000_create_semestres_table`

**Erro**: 
```
Error: P3006
Migration `20250120000000_create_semestres_table` failed to apply cleanly to the shadow database.
Error: syntax error at or near "NOT"
```

---

## 🔴 CAUSA DO PROBLEMA

O erro `syntax error at or near "NOT"` está ocorrendo porque:

1. **Linha 38**: Usa `"status" "StatusAnoLetivo" NOT NULL DEFAULT 'PLANEJADO'`
2. **Linhas 67-68**: Usam `"status" "StatusSemestre" NOT NULL DEFAULT 'PLANEJADO'` e `"estado" "EstadoRegistro" NOT NULL DEFAULT 'RASCUNHO'`

**Problema**: Quando os enums são criados dentro de blocos `DO $$`, eles podem não estar disponíveis imediatamente para uso em `CREATE TABLE IF NOT EXISTS` no mesmo script, especialmente no shadow database do Prisma.

---

## ✅ CORREÇÕES APLICADAS

### 1. Enums Criados com Tratamento de Erro ✅

**Antes** (problemático):
```sql
CREATE TYPE IF NOT EXISTS "StatusAnoLetivo" AS ENUM (...);
```

**Depois** (corrigido):
```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatusAnoLetivo') THEN
    CREATE TYPE "StatusAnoLetivo" AS ENUM ('PLANEJADO', 'ATIVO', 'ENCERRADO');
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
```

### 2. updated_at Corrigido ✅

**Problema**: `updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP` pode causar problemas quando a tabela já existe.

**Solução**: Removido `DEFAULT CURRENT_TIMESTAMP` do `updated_at` na criação. O Prisma usa `@updatedAt` que automaticamente atualiza o campo.

**Antes**:
```sql
"updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
```

**Depois**:
```sql
"updated_at" TIMESTAMP(3) NOT NULL,
```

---

## 🔍 ANÁLISE DO ERRO

O erro `syntax error at or near "NOT"` na posição 43 pode estar ocorrendo porque:

1. O enum `StatusAnoLetivo` não está sendo reconhecido no momento do `CREATE TABLE`
2. O PostgreSQL pode estar interpretando `"StatusAnoLetivo" NOT` como dois tokens separados
3. No shadow database, os enums criados em blocos `DO $$` podem não estar commitados antes do `CREATE TABLE`

---

## ✅ SOLUÇÃO DEFINITIVA

### Opção 1: Garantir que enums sejam criados ANTES (ATUAL)

✅ **Implementado**: Enums são criados em blocos separados antes do `CREATE TABLE`

### Opção 2: Criar tabela sem enums primeiro, depois adicionar (ALTERNATIVA)

Se a Opção 1 não funcionar, podemos:
1. Criar tabela com `status TEXT` inicialmente
2. Criar enums
3. Alterar coluna para usar enum

---

## 🧪 TESTAR A CORREÇÃO

```bash
cd backend

# Validar migrations
npx prisma migrate dev

# Se ainda houver erro, verificar shadow database
npx prisma migrate status
```

---

## ⚠️ SE O ERRO PERSISTIR

Se o erro continuar, podemos:

1. **Marcar migration como resolvida** (se já aplicada no banco principal):
```bash
npx prisma migrate resolve --applied 20250120000000_create_semestres_table
```

2. **Criar nova migration corrigida**:
```bash
npx prisma migrate dev --name fix_create_semestres_syntax
```

3. **Resetar shadow database** (último recurso):
```bash
# No arquivo .env, adicionar:
# SHADOW_DATABASE_URL="postgresql://..."
```

---

**Última atualização**: Janeiro 2025

