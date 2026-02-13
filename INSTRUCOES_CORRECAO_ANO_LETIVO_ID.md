# 🔧 INSTRUÇÕES: Correção do Erro `ano_letivo_id`

## ❌ Problema

Erro ao criar semestre/trimestre:
```
The column `semestres.ano_letivo_id` does not exist in the current database.
```

## ✅ Solução

A coluna `ano_letivo_id` não existe no banco de dados. É necessário executar uma migração.

### Opção 1: Via Prisma Migrate (Recomendado)

```bash
cd backend
npx prisma migrate dev --name add_ano_letivo_id_to_semestres_trimestres
npx prisma generate
```

### Opção 2: Executar SQL Manualmente

Se a Opção 1 não funcionar, execute o script SQL manualmente:

```bash
# Via psql
psql -U seu_usuario -d seu_banco -f backend/EXECUTAR_MIGRACAO_ANO_LETIVO_ID.sql

# Ou via cliente PostgreSQL (pgAdmin, DBeaver, etc.)
# Abra o arquivo backend/EXECUTAR_MIGRACAO_ANO_LETIVO_ID.sql e execute
```

### Opção 3: Via Prisma Studio (Temporário)

Se precisar criar semestres/trimestres imediatamente sem a migração:

1. Execute o SQL manualmente (Opção 2)
2. Ou aguarde a migração ser aplicada

## 📋 O que a migração faz:

1. ✅ Adiciona coluna `ano_letivo_id` em `semestres`
2. ✅ Adiciona coluna `ano_letivo_id` em `trimestres`
3. ✅ Cria índices para performance
4. ✅ Adiciona foreign keys para relação com `anos_letivos`
5. ✅ Preenche `ano_letivo_id` dos registros existentes baseado no `ano_letivo` (número)

## ⚠️ IMPORTANTE

Após executar a migração:

1. **Reinicie o servidor backend**:
   ```bash
   # Pare o servidor (Ctrl+C) e inicie novamente
   npm run dev
   ```

2. **Regenere o Prisma Client**:
   ```bash
   npx prisma generate
   ```

3. **Teste a criação de semestre/trimestre** novamente

## 🔍 Verificação

Após executar a migração, verifique se as colunas foram criadas:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('semestres', 'trimestres') 
  AND column_name = 'ano_letivo_id';
```

Deve retornar 2 linhas (uma para cada tabela).

---

**Arquivo de migração criado**: `backend/prisma/migrations/20250127120000_add_ano_letivo_id_to_semestres_trimestres/migration.sql`

**Script SQL manual**: `backend/EXECUTAR_MIGRACAO_ANO_LETIVO_ID.sql`

