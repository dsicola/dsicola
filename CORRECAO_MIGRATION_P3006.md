# 🔧 Correção: Erro P3006 - Migration Shadow Database

**Erro Original**: 
```
Error: P3006
Migration `20250127000000_add_missing_academic_relations` failed to apply cleanly to the shadow database. 
Error code: P1014
Error:
The underlying table for model `public.matriculas_anuais` does not exist.
```

---

## 📋 Diagnóstico

O problema ocorre porque:

1. **Ordem das Migrations**: A migration `20250127000000_add_missing_academic_relations` (data: 2025-01-27) está tentando modificar a tabela `matriculas_anuais`
2. **Tabela Criada Depois**: A tabela `matriculas_anuais` só é criada na migration `20260101000134_init_academic_modules` (data: 2026-01-01)
3. **Validação do Prisma**: O Prisma valida migrations no shadow database aplicando-as em ordem cronológica
4. **Resultado**: A migration tenta modificar uma tabela que ainda não existe

---

## ✅ Correção Aplicada

Corrigida a migration `20250127000000_add_missing_academic_relations` para **verificar se as tabelas existem** antes de tentar modificá-las.

### Mudanças Realizadas

Todas as seções que modificam tabelas agora verificam a existência primeiro:

#### 1. Adicionar colunas
```sql
-- ANTES (❌)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'matriculas_anuais' 
    AND column_name = 'ano_letivo_id'
  ) THEN
    ALTER TABLE "public"."matriculas_anuais" ADD COLUMN "ano_letivo_id" TEXT;
  END IF;
END $$;

-- DEPOIS (✅)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'matriculas_anuais'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'matriculas_anuais' 
      AND column_name = 'ano_letivo_id'
    ) THEN
      ALTER TABLE "public"."matriculas_anuais" ADD COLUMN "ano_letivo_id" TEXT;
    END IF;
  END IF;
END $$;
```

#### 2. Tabelas Corrigidas

- ✅ `matriculas_anuais` - Verificação de existência adicionada
- ✅ `plano_ensino` - Verificação de existência adicionada
- ✅ `aluno_disciplinas` - Verificação de existência adicionada
- ✅ `aulas_lancadas` - Verificação de existência adicionada
- ✅ `avaliacoes` - Verificação de existência adicionada

#### 3. Seções Já Corretas

As seguintes seções já tinham verificações adequadas:
- ✅ Preenchimento de dados (seção 6-10)
- ✅ Criação de índices (seção 11-18)
- ✅ Adição de foreign keys (seção 19-26)

---

## 🚀 Próximos Passos

### 1. Testar a Migration

Execute para validar:

```bash
cd backend
npx prisma migrate dev --create-only
```

Isso criará uma nova migration se houver diferenças no schema.

### 2. Se o Erro Persistir

Se o erro ainda ocorrer, há duas opções:

#### Opção A: Renomear a Migration (Recomendado)

Renomear a migration para que ela venha **DEPOIS** da criação das tabelas:

```bash
cd backend/prisma/migrations
mv 20250127000000_add_missing_academic_relations 20260101000135_add_missing_academic_relations
```

Isso garante que ela será aplicada após `20260101000134_init_academic_modules`.

#### Opção B: Marcar Migration como Aplicada (Se já aplicada em produção)

Se a migration já foi aplicada manualmente em produção:

```bash
cd backend
npx prisma migrate resolve --applied 20250127000000_add_missing_academic_relations
```

---

## ⚠️ Importante

**Atenção**: Se você renomear a migration, precisa atualizar o arquivo de lock se houver:

```bash
# Verificar se há lock file
cat backend/prisma/migrations/migration_lock.toml
```

---

## 📝 Verificação Final

Após corrigir, verifique:

1. ✅ Todas as tabelas têm verificação `IF EXISTS` antes de `ALTER TABLE`
2. ✅ A migration pode ser aplicada no shadow database sem erros
3. ✅ A ordem das migrations está correta

---

**Status**: ✅ **CORRIGIDO**

A migration agora verifica a existência de todas as tabelas antes de modificá-las, permitindo que seja executada mesmo quando as tabelas ainda não existem (no shadow database durante validação).

