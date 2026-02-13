# 🔄 SINCRONIZAÇÃO GLOBAL - Tabela semestres

## ✅ Migration Criada

**Arquivo**: `backend/prisma/migrations/20250128000000_sync_semestres_schema_final/migration.sql`

Esta migration adiciona **TODAS** as colunas faltantes do model `Semestre` de forma idempotente e segura.

## 📋 Colunas Adicionadas

A migration verifica e adiciona (se não existirem):

1. ✅ `ano_letivo_id` (TEXT)
2. ✅ `data_fim` (TIMESTAMP(3))
3. ✅ `data_inicio_notas` (TIMESTAMP(3))
4. ✅ `data_fim_notas` (TIMESTAMP(3))
5. ✅ `estado` (EstadoRegistro ou TEXT)
6. ✅ `instituicao_id` (TEXT)
7. ✅ `ativado_por` (TEXT)
8. ✅ `ativado_em` (TIMESTAMP(3))
9. ✅ `encerrado_por` (TEXT)
10. ✅ `encerrado_em` (TIMESTAMP(3))
11. ✅ `observacoes` (TEXT)
12. ✅ `encerramento_ativado_id` (TEXT) - **CORREÇÃO DO ERRO ATUAL**
13. ✅ `encerramento_encerrado_id` (TEXT)

## 🔧 Como Aplicar

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

Execute o arquivo `backend/prisma/migrations/20250128000000_sync_semestres_schema_final/migration.sql` diretamente no banco:

**Via psql:**
```bash
psql -U seu_usuario -d seu_banco -f backend/prisma/migrations/20250128000000_sync_semestres_schema_final/migration.sql
```

**Via pgAdmin/DBeaver:**
1. Abra o arquivo da migration
2. Execute o script completo

## ✅ Após Aplicar

1. **Sincronizar Prisma:**
   ```bash
   cd backend
   npx prisma db push
   npx prisma generate
   ```

2. **Reiniciar Backend:**
   ```bash
   npm run dev
   ```

3. **Validar:**
   - ✅ Endpoint `GET /semestres` funciona
   - ✅ Endpoint `POST /semestres` funciona
   - ✅ Scheduler executa sem erro
   - ✅ Nenhum erro P2022
   - ✅ Nenhum erro de coluna inexistente

## 🔍 Verificação

Para verificar quais colunas existem no banco:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'semestres'
ORDER BY ordinal_position;
```

## ⚠️ Importante

- ✅ Migration é **idempotente** (pode ser executada múltiplas vezes)
- ✅ **NÃO remove** nenhuma coluna existente
- ✅ **NÃO recria** a tabela
- ✅ **NÃO afeta** dados existentes
- ✅ Todas as colunas são **nullable** (opcionais)

## 🎯 Resultado Esperado

Após aplicar esta migration:
- ✅ Banco e Prisma totalmente alinhados
- ✅ Loop de erros P2022 eliminado
- ✅ Fluxo acadêmico estável
- ✅ Sistema institucional consolidado
- ✅ Base pronta para produção

