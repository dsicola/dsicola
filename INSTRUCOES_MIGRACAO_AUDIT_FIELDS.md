# 🔧 INSTRUÇÕES: Aplicar Migração - Campos de Auditoria

## ❌ Problema

O banco PostgreSQL não possui as colunas de auditoria nas tabelas `semestres` e `trimestres`:

- `ativado_por` (TEXT, nullable)
- `ativado_em` (TIMESTAMP(3), nullable)
- `encerrado_por` (TEXT, nullable)
- `encerrado_em` (TIMESTAMP(3), nullable)

Causando erro P2022:
```
The column semestres.ativado_por does not exist
```

## ✅ Solução

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

Execute o arquivo `backend/APLICAR_MIGRACAO_AUDIT_FIELDS_DEFINITIVA.sql` diretamente no banco:

**Via psql:**
```bash
psql -U seu_usuario -d seu_banco -f backend/APLICAR_MIGRACAO_AUDIT_FIELDS_DEFINITIVA.sql
```

**Via pgAdmin/DBeaver:**
1. Abra `backend/APLICAR_MIGRACAO_AUDIT_FIELDS_DEFINITIVA.sql`
2. Execute o script completo

### Opção 3: Marcar Migração como Aplicada (se já executou SQL manualmente)

```bash
cd backend
npx prisma migrate resolve --applied 20250127150000_add_semestre_audit_fields
```

## 📋 O que a Migração Faz

1. ✅ Adiciona `ativado_por` (TEXT, nullable) em `semestres`
2. ✅ Adiciona `ativado_em` (TIMESTAMP(3), nullable) em `semestres`
3. ✅ Adiciona `encerrado_por` (TEXT, nullable) em `semestres`
4. ✅ Adiciona `encerrado_em` (TIMESTAMP(3), nullable) em `semestres`
5. ✅ Adiciona as mesmas colunas em `trimestres`
6. ✅ Cria foreign keys para relacionar com `users`
7. ✅ Verifica resultado final

## ⚠️ Importante

- A migração é **idempotente** (pode ser executada múltiplas vezes)
- Não afeta dados existentes
- Todas as colunas são **NULLABLE** (conforme Prisma schema)

## ✅ Após Aplicar

1. **Gerar Prisma Client:**
   ```bash
   cd backend
   npx prisma generate
   ```

2. **Reiniciar o servidor:**
   ```bash
   npm run dev
   ```

3. **Validar:**
   - O erro P2022 não deve mais aparecer
   - O scheduler deve rodar sem erro
   - Log esperado: `[SchedulerService] Execução inicial concluída: { erros: [] }`

---

**Status**: 🔴 **URGENTE** - Aplicar antes de usar o sistema

