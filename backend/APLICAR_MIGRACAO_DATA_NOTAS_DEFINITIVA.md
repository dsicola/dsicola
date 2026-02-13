# 🔧 APLICAR MIGRAÇÃO: data_inicio_notas e data_fim_notas

## ❌ ERRO ATUAL

```
The column `semestres.data_inicio_notas` does not exist in the current database.
```

## ✅ SOLUÇÃO

### Opção 1: Via Prisma Migrate (Recomendado)

```bash
cd backend
npx prisma migrate deploy
```

Ou se estiver em desenvolvimento:

```bash
cd backend
npx prisma migrate dev --name add_semestre_notas_fields_definitivo
```

### Opção 2: Executar SQL Manualmente

Execute o arquivo `backend/prisma/migrations/20250128000002_add_semestre_notas_fields_definitivo/migration.sql` diretamente no banco:

**Via psql:**
```bash
psql -U seu_usuario -d seu_banco -f backend/prisma/migrations/20250128000002_add_semestre_notas_fields_definitivo/migration.sql
```

**Via pgAdmin/DBeaver:**
1. Abra o arquivo `backend/prisma/migrations/20250128000002_add_semestre_notas_fields_definitivo/migration.sql`
2. Execute o script completo

### Opção 3: Via Prisma db push (Desenvolvimento)

```bash
cd backend
npx prisma db push
npx prisma generate
```

## 📋 O QUE A MIGRAÇÃO FAZ

1. ✅ Adiciona `data_inicio_notas` em `semestres` (TIMESTAMP(3), nullable)
2. ✅ Adiciona `data_fim_notas` em `semestres` (TIMESTAMP(3), nullable)
3. ✅ Adiciona `data_inicio_notas` em `trimestres` (TIMESTAMP(3), nullable)
4. ✅ Adiciona `data_fim_notas` em `trimestres` (TIMESTAMP(3), nullable)

## ⚠️ IMPORTANTE

- ✅ Migration é **idempotente** (pode ser executada múltiplas vezes)
- ✅ Não afeta dados existentes (colunas são nullable)
- ✅ Compatível com Prisma schema atual

## ✅ APÓS APLICAR

1. **Gerar Prisma Client:**
   ```bash
   cd backend
   npx prisma generate
   ```

2. **Reiniciar servidor backend**

3. **Testar criação de semestre:**
   - Criar Ano Letivo → OK
   - Criar Semestre com `dataInicioNotas` e `dataFimNotas` → OK
   - Erro P2022 deve desaparecer

## 🔍 VALIDAÇÃO

Após aplicar, verificar no banco:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'semestres'
AND column_name IN ('data_inicio_notas', 'data_fim_notas');
```

Resultado esperado:
```
column_name         | data_type    | is_nullable
--------------------|--------------|-------------
data_inicio_notas   | timestamp(3) | YES
data_fim_notas      | timestamp(3) | YES
```

---

**Status**: 🔴 **URGENTE** - Aplicar antes de criar semestres/trimestres

