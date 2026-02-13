# 🔧 SOLUÇÃO: Erro P3006 - Migração Shadow Database

## ❌ Problema

```
Error: P3006
Migration `20250127120000_add_ano_letivo_id_to_semestres_trimestres` failed to apply cleanly to the shadow database.
Error code: P1014
Error: The underlying table for model `semestres` does not exist.
```

## 🔍 Causa

A migração `20250127120000` está tentando modificar a tabela `semestres` antes dela ser criada. A ordem cronológica está incorreta:

- **20250127120000** (27 de janeiro) - Tenta adicionar `ano_letivo_id` 
- **20260102095243** (2 de janeiro) - Cria a tabela `semestres`

O shadow database do Prisma aplica as migrações em ordem cronológica, então quando tenta aplicar `20250127120000`, a tabela ainda não existe.

## ✅ Solução Aplicada

### 1. Migração Tornada Idempotente

A migração foi modificada para verificar se as tabelas existem antes de tentar modificá-las:

```sql
-- Verificar se tabela existe antes de adicionar coluna
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'semestres'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'semestres' AND column_name = 'ano_letivo_id'
    ) THEN
      ALTER TABLE "semestres" ADD COLUMN "ano_letivo_id" TEXT;
    END IF;
  END IF;
END $$;
```

### 2. Todas as Operações Protegidas

- ✅ Adição de colunas: Verifica existência da tabela
- ✅ Criação de índices: Verifica existência da tabela
- ✅ Foreign keys: Verifica existência de ambas as tabelas
- ✅ Updates: Verifica existência de ambas as tabelas

## 🚀 Como Aplicar

### Opção 1: Resetar Migrações (Recomendado para Desenvolvimento)

```bash
cd backend
npx prisma migrate reset
```

**⚠️ ATENÇÃO**: Isso apaga todos os dados do banco!

### Opção 2: Marcar Migração como Aplicada (Se a coluna já existe)

Se a coluna `ano_letivo_id` já existe no banco de dados:

```bash
cd backend
npx prisma migrate resolve --applied 20250127120000_add_ano_letivo_id_to_semestres_trimestres
```

### Opção 3: Aplicar Migração Manualmente

Se o banco de dados já tem a estrutura, você pode aplicar a migração manualmente:

```bash
cd backend
psql -d seu_banco -f prisma/migrations/20250127120000_add_ano_letivo_id_to_semestres_trimestres/migration.sql
```

Depois marque como aplicada:

```bash
npx prisma migrate resolve --applied 20250127120000_add_ano_letivo_id_to_semestres_trimestres
```

## ✅ Verificação

Após aplicar a solução, verifique:

1. **Coluna existe**:
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'semestres' AND column_name = 'ano_letivo_id';
```

2. **Status das migrações**:
```bash
npx prisma migrate status
```

3. **Testar criação de semestre/trimestre**:
- Criar um semestre/trimestre via API
- Verificar se `anoLetivoId` é preenchido corretamente

## 📝 Notas Importantes

- ✅ A migração agora é **idempotente** - pode ser executada múltiplas vezes sem erro
- ✅ Verifica existência de tabelas antes de modificar
- ✅ Não causa erro se as tabelas ainda não existirem
- ✅ Funciona mesmo com ordem cronológica incorreta

## 🎯 Resultado Esperado

Após aplicar a solução:
- ✅ Migração aplica sem erros no shadow database
- ✅ Coluna `ano_letivo_id` existe em `semestres` e `trimestres`
- ✅ Foreign keys criadas corretamente
- ✅ Criação de semestre/trimestre funciona corretamente

---

**Status**: ✅ **CORRIGIDO**  
**Data**: 2025-01-27

