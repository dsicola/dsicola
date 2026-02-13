# 🔧 INSTRUÇÕES: Aplicar Migração - Campos de Encerramento Acadêmico

## ❌ Problema

O banco de dados não possui as colunas `encerramento_ativado_id` e `encerramento_encerrado_id` na tabela `semestres`, causando erro:

```
The column `semestres.encerramento_ativado_id` does not exist in the current database.
```

## ✅ Solução

### Opção 1: Executar SQL Manualmente (Recomendado)

Execute o arquivo `backend/APLICAR_MIGRACAO_ENCERRAMENTO_SEMESTRES.sql` diretamente no banco de dados:

**Via psql:**
```bash
psql -U seu_usuario -d seu_banco -f backend/APLICAR_MIGRACAO_ENCERRAMENTO_SEMESTRES.sql
```

**Via pgAdmin ou DBeaver:**
1. Abra o arquivo `backend/APLICAR_MIGRACAO_ENCERRAMENTO_SEMESTRES.sql`
2. Execute o script completo

### Opção 2: Via Prisma Migrate

```bash
cd backend
npx prisma migrate deploy
```

Ou se estiver em desenvolvimento:

```bash
cd backend
npx prisma migrate dev --name add_semestre_encerramento_fields
```

### Opção 3: Via Prisma DB Push (Desenvolvimento)

```bash
cd backend
npx prisma db push
```

**⚠️ ATENÇÃO**: `db push` não cria migrações, apenas sincroniza o schema. Use apenas em desenvolvimento.

## 📋 O que a Migração Faz

1. ✅ Adiciona coluna `encerramento_ativado_id` em `semestres` (TEXT, nullable)
2. ✅ Adiciona coluna `encerramento_encerrado_id` em `semestres` (TEXT, nullable)
3. ✅ Adiciona foreign keys para `encerramentos_academicos` (se a tabela existir)
4. ✅ Cria índices para melhorar performance
5. ✅ Verifica o resultado final

## ⚠️ Importante

- A migração é **idempotente** (pode ser executada múltiplas vezes sem erro)
- Não afeta dados existentes
- As colunas são nullable (opcionais) para compatibilidade com dados antigos
- Foreign keys são adicionadas apenas se a tabela `encerramentos_academicos` existir

## ✅ Após Aplicar

1. **Gerar Prisma Client:**
   ```bash
   cd backend
   npx prisma generate
   ```

2. **Reiniciar o servidor backend**

3. **Testar:**
   - Listar semestres (GET /semestres) - **Deve funcionar sem erro P2022**
   - Criar semestre (POST /semestres)
   - Encerrar semestre (via encerramento acadêmico)

4. **Validar:**
   - ✅ Nenhum erro P2022
   - ✅ Encerramento acadêmico funciona corretamente
   - ✅ Auditoria registra corretamente
   - ✅ Campos `encerramento_ativado_id` e `encerramento_encerrado_id` existem no banco

## 🔍 Verificação Manual

Para verificar se as colunas foram adicionadas:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'semestres'
  AND column_name IN ('encerramento_ativado_id', 'encerramento_encerrado_id');
```

---

**Status**: 🔴 **URGENTE** - Aplicar antes de usar listagem/criação de semestres

