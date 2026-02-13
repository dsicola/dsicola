# 🔴 CORREÇÃO URGENTE: Erro `ano_letivo_id` não existe

## ❌ Problema Identificado

O Prisma Client foi gerado com o schema que inclui `anoLetivoId`, mas o banco de dados **não tem essa coluna ainda**. Isso causa erro em **TODAS** as queries de `Semestre` e `Trimestre`:

```
The column `semestres.ano_letivo_id` does not exist in the current database.
```

**Erro ocorre em:**
- ✅ `semestreScheduler.service.ts` - **CORRIGIDO temporariamente**
- ⚠️ Todas as outras queries de `Semestre` e `Trimestre` ainda podem falhar

## ✅ Solução Definitiva (3 Passos OBRIGATÓRIOS)

### Passo 1: Aplicar Migração SQL ⚠️ OBRIGATÓRIO

Execute o SQL diretamente no banco de dados:

**Via psql:**
```bash
psql -U seu_usuario -d seu_banco -f backend/APLICAR_MIGRACAO_URGENTE.sql
```

**Via pgAdmin/DBeaver:**
1. Abra `backend/APLICAR_MIGRACAO_URGENTE.sql`
2. Execute o script completo

**Via Prisma Migrate:**
```bash
cd backend
npx prisma migrate deploy
```

### Passo 2: Regenerar Prisma Client ⚠️ OBRIGATÓRIO

**CRÍTICO**: Após aplicar a migração, você **DEVE** regenerar o Prisma Client:

```bash
cd backend
npx prisma generate
```

**Por quê?** O Prisma Client foi gerado com base no schema que tem `anoLetivoId`. Mesmo após aplicar a migração, o Prisma Client ainda está "desatualizado" até você regenerá-lo.

### Passo 3: Reiniciar Servidor ⚠️ OBRIGATÓRIO

```bash
# Pare o servidor (Ctrl+C) e reinicie
npm run dev
```

## 🔍 Por que isso acontece?

1. ✅ Schema Prisma (`schema.prisma`) define `anoLetivoId` ✅
2. ✅ Prisma Client foi gerado com base nesse schema ✅
3. ❌ Banco de dados **não tem** a coluna ainda ❌
4. ❌ Quando o Prisma tenta fazer qualquer query, ele automaticamente tenta buscar `ano_letivo_id` ❌
5. ❌ Erro: coluna não existe ❌

## ✅ Correções Temporárias Aplicadas

Para evitar que o sistema trave completamente, apliquei correções temporárias:

1. ✅ **semestreScheduler.service.ts**: Usa `select` explícito para evitar buscar `anoLetivoId`
2. ✅ **semestre.controller.ts**: Já inclui `anoLetivoId` na criação (correto)
3. ✅ **trimestre.controller.ts**: Já inclui `anoLetivoId` na criação (correto)

**Mas essas são apenas correções temporárias!** A solução definitiva é aplicar a migração.

## ⚠️ IMPORTANTE

**NUNCA pule o Passo 2** (regenerar Prisma Client). Sem isso, o erro continuará mesmo após aplicar a migração.

## ✅ Verificação

Após aplicar a migração, verifique:

```sql
-- Verificar se coluna existe
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('semestres', 'trimestres') 
  AND column_name = 'ano_letivo_id';
```

Deve retornar 2 linhas (uma para cada tabela).

## 📋 Checklist de Aplicação

- [ ] **Passo 1**: Aplicar migração SQL
- [ ] **Passo 2**: Regenerar Prisma Client (`npx prisma generate`)
- [ ] **Passo 3**: Reiniciar servidor
- [ ] **Verificação**: Testar criação de semestre/trimestre
- [ ] **Verificação**: Verificar se scheduler não dá mais erro

---

**Status**: 🔴 **URGENTE** - Aplicar antes de usar qualquer funcionalidade de semestres/trimestres

**Arquivos criados:**
- ✅ `backend/APLICAR_MIGRACAO_URGENTE.sql` - Script SQL para executar
- ✅ `INSTRUCOES_APLICAR_MIGRACAO.md` - Instruções detalhadas
- ✅ `SOLUCAO_COMPLETA_ANO_LETIVO_ID.md` - Solução completa
- ✅ `CORRECAO_URGENTE_ANO_LETIVO_ID.md` - Este arquivo

