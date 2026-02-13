# 🔧 SOLUÇÃO: Erro P2022 - data_inicio_notas não existe

## ❌ ERRO

```
The column `semestres.data_inicio_notas` does not exist in the current database.
```

## 🔍 CAUSA

O Prisma schema (`schema.prisma`) define os campos `dataInicioNotas` e `dataFimNotas` no model `Semestre`, mas o banco de dados PostgreSQL ainda não possui essas colunas.

## ✅ SOLUÇÃO DEFINITIVA

### Passo 1: Aplicar Migration SQL

Execute o script SQL diretamente no banco de dados:

**Opção A: Via psql (linha de comando)**
```bash
psql -U seu_usuario -d seu_banco -f backend/APLICAR_COLUNAS_NOTAS_SEMESTRES_TRIMESTRES.sql
```

**Opção B: Via pgAdmin/DBeaver**
1. Abra o arquivo `backend/APLICAR_COLUNAS_NOTAS_SEMESTRES_TRIMESTRES.sql`
2. Execute o script completo

**Opção C: Via cliente PostgreSQL**
```sql
-- Copie e cole o conteúdo de backend/APLICAR_COLUNAS_NOTAS_SEMESTRES_TRIMESTRES.sql
```

### Passo 2: Marcar Migration como Aplicada (se usar Prisma Migrate)

```bash
cd backend
npx prisma migrate resolve --applied 20250128000002_add_semestre_notas_fields_definitivo
```

### Passo 3: Gerar Prisma Client

```bash
cd backend
npx prisma generate
```

### Passo 4: Reiniciar Servidor

```bash
cd backend
npm run dev
```

## 📋 O QUE A MIGRAÇÃO FAZ

1. ✅ Adiciona `data_inicio_notas` em `semestres` (TIMESTAMP(3), nullable)
2. ✅ Adiciona `data_fim_notas` em `semestres` (TIMESTAMP(3), nullable)
3. ✅ Adiciona `data_inicio_notas` em `trimestres` (TIMESTAMP(3), nullable)
4. ✅ Adiciona `data_fim_notas` em `trimestres` (TIMESTAMP(3), nullable)

## 🔍 VALIDAÇÃO

Após aplicar, verificar no banco:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('semestres', 'trimestres')
AND column_name IN ('data_inicio_notas', 'data_fim_notas')
ORDER BY table_name, column_name;
```

**Resultado esperado:**
```
table_name  | column_name        | data_type    | is_nullable
------------|--------------------|--------------|-------------
semestres   | data_inicio_notas  | timestamp(3) | YES
semestres   | data_fim_notas     | timestamp(3) | YES
trimestres  | data_inicio_notas  | timestamp(3) | YES
trimestres  | data_fim_notas     | timestamp(3) | YES
```

## ✅ TESTE FINAL

1. **Criar Ano Letivo:**
   ```json
   POST /anos-letivos
   {
     "ano": 2025,
     "dataInicio": "2025-01-01",
     "dataFim": "2025-12-31"
   }
   ```

2. **Criar Semestre:**
   ```json
   POST /semestres
   {
     "anoLetivo": 2025,
     "numero": 1,
     "dataInicio": "2025-01-01",
     "dataFim": "2025-06-30",
     "dataInicioNotas": "2025-01-15",
     "dataFimNotas": "2025-06-15"
   }
   ```

3. **Verificar:** Não deve ocorrer erro P2022

## ⚠️ IMPORTANTE

- ✅ Migration é **idempotente** (pode ser executada múltiplas vezes)
- ✅ Não afeta dados existentes (colunas são nullable)
- ✅ Compatível com Prisma schema atual
- ✅ Mantém todas as regras acadêmicas

## 📝 ARQUIVOS CRIADOS

1. `backend/prisma/migrations/20250128000002_add_semestre_notas_fields_definitivo/migration.sql`
2. `backend/APLICAR_COLUNAS_NOTAS_SEMESTRES_TRIMESTRES.sql`
3. `backend/APLICAR_MIGRACAO_DATA_NOTAS_DEFINITIVA.md`
4. `SOLUCAO_ERRO_P2022_DATA_NOTAS.md` (este arquivo)

---

**Status**: ✅ **PRONTO PARA APLICAR**  
**Prioridade**: 🔴 **URGENTE**

