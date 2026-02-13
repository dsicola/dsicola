# 🔧 INSTRUÇÕES: Sincronização Global Definitiva - Tabela semestres

## ❌ Problema Crítico

O sistema está preso em um **LOOP de erro Prisma P2022**:
- Sempre que uma nova regra acadêmica é adicionada, o código referencia uma coluna que NÃO existe no banco
- Erro atual: `The column semestres.encerramento_ativado_id does not exist`
- Padrão recorrente: `ano_letivo_id`, `data_inicio_notas`, `ativado_por`, etc.

## ✅ Solução Definitiva

Criada uma **ÚNICA migration de sincronização total** que alinha COMPLETAMENTE o schema Prisma com o banco PostgreSQL.

---

## 📋 Passo a Passo

### 1. **Aplicar a Migration**

**Opção A: Via Prisma Migrate (Recomendado)**

```bash
cd backend
npx prisma migrate deploy
```

**Opção B: Executar SQL Manualmente**

```bash
psql -U seu_usuario -d seu_banco -f backend/prisma/migrations/20250127000000_sync_semestres_schema_final/migration.sql
```

**Opção C: Via pgAdmin/DBeaver**
1. Abra o arquivo: `backend/prisma/migrations/20250127000000_sync_semestres_schema_final/migration.sql`
2. Execute o script completo

### 2. **Sincronizar Prisma**

```bash
cd backend
npx prisma db push
npx prisma generate
```

### 3. **Reiniciar Backend**

```bash
npm run dev
```

---

## 📊 O que a Migration Faz

A migration `sync_semestres_schema_final` adiciona **TODAS** as colunas faltantes:

### ✅ Colunas de Período Acadêmico
- `ano_letivo_id` (FK para `anos_letivos`)

### ✅ Colunas de Controle de Notas
- `data_inicio_notas`
- `data_fim_notas`

### ✅ Colunas de Estado/Workflow
- `estado` (enum `EstadoRegistro`)

### ✅ Colunas de Auditoria (Ativação)
- `ativado_por` (renomeia de `iniciado_por` se existir)
- `ativado_em` (renomeia de `iniciado_em` se existir)

### ✅ Colunas de Encerramento Acadêmico
- `encerramento_ativado_id` (FK para `encerramentos_academicos`)
- `encerramento_encerrado_id` (FK para `encerramentos_academicos`)

### ✅ Foreign Keys e Índices
- FK: `ano_letivo_id` → `anos_letivos.id`
- FK: `encerramento_ativado_id` → `encerramentos_academicos.id`
- FK: `encerramento_encerrado_id` → `encerramentos_academicos.id`
- Índices para performance

---

## ✅ Validação Final

Após aplicar a migration, verifique:

1. **Endpoint GET /semestres funciona**
   ```bash
   curl http://localhost:3001/semestres
   ```

2. **Endpoint POST /semestres funciona**
   ```bash
   curl -X POST http://localhost:3001/semestres \
     -H "Content-Type: application/json" \
     -d '{"anoLetivo": 2025, "numero": 1, "dataInicio": "2025-01-01"}'
   ```

3. **Scheduler executa sem erro**
   - Verifique os logs do backend
   - Não deve haver erros P2022

4. **Nenhum erro de coluna inexistente**
   - Teste todas as operações CRUD de semestres

---

## ⚠️ Importante

- ✅ Migration é **idempotente** (pode ser executada múltiplas vezes)
- ✅ **NÃO remove** nenhuma coluna existente
- ✅ **NÃO recria** a tabela
- ✅ Garante **NULLABLE** para dados antigos
- ✅ Preserva todos os dados existentes

---

## 🎯 Critério de Sucesso

- ✔ Banco e Prisma totalmente alinhados
- ✔ Loop de erros eliminado
- ✔ Fluxo acadêmico estável
- ✔ Sistema institucional consolidado
- ✔ Base pronta para produção

---

**Status**: 🔴 **URGENTE** - Aplicar antes de continuar desenvolvimento

**Arquivo da Migration**: `backend/prisma/migrations/20250127000000_sync_semestres_schema_final/migration.sql`

