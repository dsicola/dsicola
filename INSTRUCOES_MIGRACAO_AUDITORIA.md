# 🔧 INSTRUÇÕES: Aplicar Migração de Campos de Auditoria

## ❌ Problema Identificado

O banco de dados possui colunas com nomes antigos (`iniciado_por`, `iniciado_em`) ou não possui as colunas de auditoria (`ativado_por`, `ativado_em`, `encerrado_por`, `encerrado_em`) que o schema Prisma espera, causando erro:

```
The column `semestres.ativado_por` does not exist in the current database
```

## ✅ Solução

A migração `20250128000000_add_semestre_audit_fields` foi criada para:

1. **Renomear colunas antigas** (se existirem):
   - `iniciado_por` → `ativado_por`
   - `iniciado_em` → `ativado_em`

2. **Adicionar colunas faltantes** (se não existirem):
   - `ativado_por` (TEXT, nullable)
   - `ativado_em` (TIMESTAMP(3), nullable)
   - `encerrado_por` (TEXT, nullable)
   - `encerrado_em` (TIMESTAMP(3), nullable)

3. **Aplicar para ambas as tabelas**:
   - `semestres`
   - `trimestres`

4. **Criar foreign keys** para relacionar com a tabela `users`

## 📋 Como Aplicar

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

Execute o arquivo `backend/prisma/migrations/20250128000000_add_semestre_audit_fields/migration.sql` diretamente no banco de dados:

**Via psql:**
```bash
psql -U seu_usuario -d seu_banco -f backend/prisma/migrations/20250128000000_add_semestre_audit_fields/migration.sql
```

**Via pgAdmin ou DBeaver:**
1. Abra o arquivo `backend/prisma/migrations/20250128000000_add_semestre_audit_fields/migration.sql`
2. Execute o script completo

## ⚠️ Importante

- A migração é **idempotente** (pode ser executada múltiplas vezes sem erro)
- Não afeta dados existentes
- Preserva foreign keys existentes
- Renomeia colunas antigas automaticamente

## ✅ Após Aplicar

1. **Regenerar Prisma Client:**
   ```bash
   cd backend
   npx prisma generate
   ```

2. **Reiniciar o servidor backend**

3. **Validar o Scheduler:**
   - O job deve rodar sem erro
   - Semestres com status `PLANEJADO` e `data_inicio <= hoje` devem ser iniciados
   - Campos `ativado_por` e `ativado_em` devem ser preenchidos corretamente
   - Nenhuma exceção P2022 deve ocorrer

## 🔍 Validação

Após aplicar a migração, verifique se as colunas existem:

```sql
-- Verificar colunas em semestres
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'semestres'
AND column_name IN ('ativado_por', 'ativado_em', 'encerrado_por', 'encerrado_em');

-- Verificar colunas em trimestres
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'trimestres'
AND column_name IN ('ativado_por', 'ativado_em', 'encerrado_por', 'encerrado_em');
```

---

**Status**: 🔴 **URGENTE** - Aplicar antes de usar o Scheduler automático

