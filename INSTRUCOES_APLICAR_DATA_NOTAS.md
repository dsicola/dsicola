# 🔧 INSTRUÇÕES: Aplicar Migração Urgente - data_inicio_notas e data_fim_notas

## ❌ Problema

O banco de dados não possui as colunas `data_inicio_notas` e `data_fim_notas` nas tabelas `semestres` e `trimestres`, causando erro:

```
The column `semestres.data_inicio_notas` does not exist in the current database.
```

## ✅ Solução Rápida

### Opção 1: Executar SQL Manualmente (Recomendado)

Execute o arquivo `backend/APLICAR_COLUNAS_DATA_NOTAS_URGENTE.sql` diretamente no banco de dados:

**Via psql:**
```bash
psql -U seu_usuario -d seu_banco -f backend/APLICAR_COLUNAS_DATA_NOTAS_URGENTE.sql
```

**Via pgAdmin ou DBeaver:**
1. Abra o arquivo `backend/APLICAR_COLUNAS_DATA_NOTAS_URGENTE.sql`
2. Execute o script completo

**Via cliente PostgreSQL:**
```sql
-- Copie e cole o conteúdo de backend/APLICAR_COLUNAS_DATA_NOTAS_URGENTE.sql
```

### Opção 2: Via Prisma Migrate

```bash
cd backend
npx prisma migrate dev --name add_data_notas_columns
```

**Nota**: Se usar Prisma Migrate, pode ser necessário criar a migração manualmente primeiro.

## 📋 O que a Migração Faz

1. ✅ Adiciona coluna `data_inicio_notas` em `semestres` (se não existir)
2. ✅ Adiciona coluna `data_fim_notas` em `semestres` (se não existir)
3. ✅ Adiciona coluna `data_inicio_notas` em `trimestres` (se não existir)
4. ✅ Adiciona coluna `data_fim_notas` em `trimestres` (se não existir)
5. ✅ Verifica o resultado final

## ⚠️ Importante

- A migração é **idempotente** (pode ser executada múltiplas vezes sem erro)
- Não afeta dados existentes
- Apenas adiciona as colunas necessárias (nullable)

## ✅ Após Aplicar

1. Reinicie o servidor backend
2. Teste listar/criar semestres/trimestres
3. O erro deve estar resolvido

---

**Status**: 🔴 **URGENTE** - Aplicar antes de usar criação/listagem de semestres/trimestres

