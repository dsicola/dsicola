# 🔧 Instruções: Corrigir Erro de Migration - ano_letivo_id NULL

## 🎯 Problema

Existem registros com `ano_letivo_id` NULL em:
- `matriculas_anuais`: 2 registros
- `plano_ensino`: 1 registro

Isso impede que a coluna seja tornada obrigatória (NOT NULL).

## ✅ Solução Passo a Passo

### PASSO 1: Preencher valores NULL

Execute o script SQL para preencher os valores NULL:

**Opção A - Via psql**:
```bash
psql -U seu_usuario -d dsicola -f backend/prisma/migrations/FIX_NULL_ANO_LETIVO_ID.sql
```

**Opção B - Via pgAdmin/DBeaver**:
1. Abra o arquivo `backend/prisma/migrations/FIX_NULL_ANO_LETIVO_ID.sql`
2. Execute o script completo

### PASSO 2: Verificar que não há mais NULL

```sql
SELECT 'matriculas_anuais' as tabela, COUNT(*) as nulls
FROM matriculas_anuais WHERE ano_letivo_id IS NULL
UNION ALL
SELECT 'plano_ensino' as tabela, COUNT(*) as nulls
FROM plano_ensino WHERE ano_letivo_id IS NULL;
```

**Deve retornar 0 para ambos!**

### PASSO 3: Aplicar mudanças do schema

Agora você pode aplicar as mudanças:

```bash
cd backend
npx prisma db push
npx prisma generate
```

### PASSO 4: Aplicar migration de turmas (se necessário)

Se a migration `20260131000000_add_ano_letivo_id_to_turmas` ainda não foi aplicada:

```bash
cd backend
# Verificar se migration já foi aplicada
psql -U seu_usuario -d dsicola -c "SELECT migration_name FROM _prisma_migrations WHERE migration_name LIKE '%turmas%';"

# Se não estiver aplicada, executar manualmente
psql -U seu_usuario -d dsicola -f backend/prisma/migrations/20260131000000_add_ano_letivo_id_to_turmas/migration.sql
```

## ⚠️ ATENÇÃO

Se o script não conseguir preencher alguns registros (aviso de WARNING), você tem 3 opções:

1. **Criar anos letivos faltantes** para essas instituições
2. **Remover os registros problemáticos** (se não forem importantes)
3. **Preencher manualmente** os `ano_letivo_id` NULL antes de continuar

## ✅ Verificação Final

Após corrigir, verifique:

```sql
-- Verificar se todas as colunas estão preenchidas
SELECT 
  (SELECT COUNT(*) FROM matriculas_anuais WHERE ano_letivo_id IS NULL) as matriculas_null,
  (SELECT COUNT(*) FROM plano_ensino WHERE ano_letivo_id IS NULL) as planos_null,
  (SELECT COUNT(*) FROM turmas WHERE ano_letivo_id IS NULL) as turmas_null;
```

Todos devem ser 0 antes de aplicar as migrations!

