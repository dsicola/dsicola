# 🔧 SOLUÇÃO COMPLETA: Erro `ano_letivo_id` não existe

## ❌ Problema

O Prisma Client foi gerado com o schema que inclui `anoLetivoId`, mas o banco de dados não tem essa coluna ainda. Isso causa erro em **TODAS** as queries de `Semestre` e `Trimestre`:

```
The column `semestres.ano_letivo_id` does not exist in the current database.
```

## ✅ Solução em 3 Passos

### Passo 1: Aplicar Migração SQL

Execute o SQL diretamente no banco de dados:

**Opção A: Via psql**
```bash
psql -U seu_usuario -d seu_banco -f backend/APLICAR_MIGRACAO_URGENTE.sql
```

**Opção B: Via pgAdmin/DBeaver**
1. Abra `backend/APLICAR_MIGRACAO_URGENTE.sql`
2. Execute o script completo

**Opção C: Via Prisma Migrate**
```bash
cd backend
npx prisma migrate deploy
```

### Passo 2: Regenerar Prisma Client

**CRÍTICO**: Após aplicar a migração, você DEVE regenerar o Prisma Client:

```bash
cd backend
npx prisma generate
```

Isso atualiza o Prisma Client para refletir o estado atual do banco de dados.

### Passo 3: Reiniciar Servidor

```bash
# Pare o servidor (Ctrl+C) e reinicie
npm run dev
```

## 🔍 Por que isso acontece?

1. O schema Prisma (`schema.prisma`) define `anoLetivoId`
2. O Prisma Client foi gerado com base nesse schema
3. O banco de dados não tem a coluna ainda
4. Quando o Prisma tenta fazer qualquer query, ele automaticamente tenta buscar `ano_letivo_id`
5. Erro: coluna não existe

## ✅ Verificação

Após aplicar a migração, verifique:

```sql
-- Verificar se coluna existe
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('semestres', 'trimestres') 
  AND column_name = 'ano_letivo_id';
```

Deve retornar 2 linhas.

## ⚠️ IMPORTANTE

**NUNCA pule o Passo 2** (regenerar Prisma Client). Sem isso, o erro continuará mesmo após aplicar a migração.

---

**Status**: 🔴 **URGENTE** - Aplicar antes de usar qualquer funcionalidade de semestres/trimestres

