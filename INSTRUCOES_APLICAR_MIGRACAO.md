# 🔧 INSTRUÇÕES: Aplicar Migração Urgente - ano_letivo_id

## ❌ Problema

O banco de dados não possui a coluna `ano_letivo_id` nas tabelas `semestres` e `trimestres`, causando erro:

```
The column `semestres.ano_letivo_id` does not exist in the current database.
```

## ✅ Solução Rápida

### Opção 1: Via Prisma Migrate (Recomendado)

```bash
cd backend
npx prisma migrate deploy
```

Ou se estiver em desenvolvimento:

```bash
cd backend
npx prisma migrate dev
```

### Opção 2: Executar SQL Manualmente

Execute o arquivo `backend/APLICAR_MIGRACAO_URGENTE.sql` diretamente no banco de dados:

**Via psql:**
```bash
psql -U seu_usuario -d seu_banco -f backend/APLICAR_MIGRACAO_URGENTE.sql
```

**Via pgAdmin ou DBeaver:**
1. Abra o arquivo `backend/APLICAR_MIGRACAO_URGENTE.sql`
2. Execute o script completo

**Via cliente PostgreSQL:**
```sql
-- Copie e cole o conteúdo de backend/APLICAR_MIGRACAO_URGENTE.sql
```

### Opção 3: Via Prisma Studio (Temporário)

Se não conseguir aplicar a migração agora, você pode temporariamente comentar o uso de `anoLetivoId` no código, mas **NÃO É RECOMENDADO**.

## 📋 O que a Migração Faz

1. ✅ Adiciona coluna `ano_letivo_id` em `semestres` (se não existir)
2. ✅ Adiciona coluna `ano_letivo_id` em `trimestres` (se não existir)
3. ✅ Cria índices para melhorar performance
4. ✅ Adiciona foreign keys para relacionar com `anos_letivos`
5. ✅ Preenche `ano_letivo_id` em registros existentes baseado no `ano_letivo` (número)

## ⚠️ Importante

- A migração é **idempotente** (pode ser executada múltiplas vezes sem erro)
- Não afeta dados existentes
- Apenas adiciona a coluna e relacionamento necessário

## ✅ Após Aplicar

1. Reinicie o servidor backend
2. Teste criar um semestre/trimestre
3. O erro deve estar resolvido

---

**Status**: 🔴 **URGENTE** - Aplicar antes de usar criação de semestres/trimestres
