# 🔧 GUIA: Aplicar Migration - Colunas de Notas em Semestres

## ❌ ERRO ATUAL

```
The column `semestres.data_inicio_notas` does not exist in the current database
```

## ✅ SOLUÇÃO

### Opção 1: Via Prisma Migrate (Recomendado)

```bash
cd backend

# 1. Verificar status das migrations
npx prisma migrate status

# 2. Aplicar migration pendente (se houver)
npx prisma migrate deploy

# 3. Se a migration já foi marcada como aplicada mas as colunas não existem:
#    Marcar como não aplicada e reaplicar
npx prisma migrate resolve --rolled-back 20250128000000_add_semestre_notas_fields
npx prisma migrate deploy

# 4. Gerar Prisma Client
npx prisma generate
```

### Opção 2: Executar SQL Manualmente (Se Prisma Migrate falhar)

```bash
cd backend

# Executar o SQL diretamente no banco
psql -U seu_usuario -d seu_banco -f prisma/migrations/20250128000001_add_semestre_notas_fields_fix/migration.sql
```

Ou via cliente PostgreSQL (pgAdmin, DBeaver):

1. Abra o arquivo: `backend/prisma/migrations/20250128000001_add_semestre_notas_fields_fix/migration.sql`
2. Execute o script completo

### Opção 3: Usar Prisma db push (Desenvolvimento)

```bash
cd backend

# Sincronizar schema com banco (cuidado: pode perder dados em produção)
npx prisma db push

# Gerar Prisma Client
npx prisma generate
```

---

## ✅ VALIDAÇÃO

### 1. Verificar se as colunas existem

Execute o script SQL:

```bash
psql -U seu_usuario -d seu_banco -f VERIFICAR_COLUNAS_SEMESTRES.sql
```

Ou execute diretamente:

```sql
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'semestres'
  AND column_name IN ('data_inicio_notas', 'data_fim_notas');
```

**Resultado esperado**:
```
column_name        | data_type    | is_nullable
-------------------|--------------|-------------
data_inicio_notas  | timestamp(3) | YES
data_fim_notas     | timestamp(3) | YES
```

### 2. Testar criação de semestre

```bash
# Reiniciar servidor backend
npm run dev

# Testar criação via API ou frontend
```

---

## 📋 CHECKLIST

- [ ] Migration aplicada com sucesso
- [ ] Colunas `data_inicio_notas` e `data_fim_notas` existem na tabela `semestres`
- [ ] Prisma Client gerado (`npx prisma generate`)
- [ ] Servidor backend reiniciado
- [ ] Teste de criação de semestre funcionando
- [ ] Nenhum erro P2022

---

## ⚠️ IMPORTANTE

- ✅ Migration é **idempotente** (pode ser executada múltiplas vezes)
- ✅ Colunas são **NULLABLE** (não afeta dados existentes)
- ✅ Não remove nenhuma regra acadêmica
- ✅ Não quebra fluxo institucional

---

## 🆘 SE AINDA HOUVER ERRO

1. **Verificar se tabela semestres existe**:
   ```sql
   SELECT EXISTS (
     SELECT 1 FROM information_schema.tables 
     WHERE table_name = 'semestres'
   );
   ```

2. **Verificar permissões do usuário**:
   - Usuário precisa de permissão `ALTER TABLE` na tabela `semestres`

3. **Verificar se há locks na tabela**:
   ```sql
   SELECT * FROM pg_locks WHERE relation = 'semestres'::regclass;
   ```

4. **Aplicar SQL manualmente**:
   ```sql
   ALTER TABLE "public"."semestres" 
   ADD COLUMN IF NOT EXISTS "data_inicio_notas" TIMESTAMP(3),
   ADD COLUMN IF NOT EXISTS "data_fim_notas" TIMESTAMP(3);
   ```

