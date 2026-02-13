# 🚀 INSTRUÇÕES: Aplicar Baseline Definitivo

**Objetivo**: Resolver definitivamente os erros P3006/P1014 relacionados à tabela `semestres`.

---

## ✅ PRÉ-REQUISITOS

1. ✅ **Ambiente de DESENVOLVIMENTO** (é permitido resetar banco)
2. ✅ **Backup feito** (se tiver dados importantes)
3. ✅ **DATABASE_URL configurada** no `.env`

---

## 🎯 OPÇÃO 1: Script Automatizado (RECOMENDADO)

```bash
cd backend
./APLICAR_BASELINE.sh
```

O script vai:
1. ✅ Validar schema Prisma
2. ✅ Resetar migrations (drop + recreate)
3. ✅ Aplicar baseline
4. ✅ Gerar Prisma Client
5. ✅ Validar status

---

## 🎯 OPÇÃO 2: Manual (Passo a Passo)

### Passo 1: Validar Schema

```bash
cd backend
npx prisma validate
```

**Esperado**: ✅ Schema validado com sucesso

---

### Passo 2: Resetar Migrations

```bash
npx prisma migrate reset --skip-seed
```

**O que faz**:
- Dropa todas as tabelas
- Recria banco limpo
- Aplica todas as migrations na ordem

**Esperado**: ✅ Database reset successful

---

### Passo 3: Aplicar Baseline

```bash
npx prisma migrate deploy
```

**Esperado**: ✅ Applied migration `20260202000000_baseline_academic_tables`

---

### Passo 4: Gerar Prisma Client

```bash
npx prisma generate
```

**Esperado**: ✅ Generated Prisma Client

---

### Passo 5: Validar Status

```bash
npx prisma migrate status
```

**Esperado**: 
```
Database schema is up to date!

Following migrations have been applied:

migrations/
  └─ 20260202000000_baseline_academic_tables/
      └─ migration.sql
```

---

## ✅ VALIDAÇÃO FINAL

### 1. Verificar Tabelas Criadas

```bash
# Via psql
psql -U seu_usuario -d seu_banco -c "\dt" | grep -E "(anos_letivos|semestres|trimestres)"

# Via Prisma Studio
npx prisma studio
```

**Esperado**: Ver as 3 tabelas:
- ✅ `anos_letivos`
- ✅ `semestres`
- ✅ `trimestres`

---

### 2. Testar Criar Ano Letivo

```bash
# Via Prisma Studio (GUI)
npx prisma studio
# Criar um Ano Letivo manualmente

# OU via API (se servidor estiver rodando)
curl -X POST http://localhost:3000/api/anos-letivos \
  -H "Content-Type: application/json" \
  -d '{"ano": 2025, "dataInicio": "2025-01-01"}'
```

**Esperado**: ✅ Ano Letivo criado com sucesso

---

### 3. Testar Criar Semestre

```bash
# Via Prisma Studio
# Criar um Semestre vinculado ao Ano Letivo criado acima

# OU via API
curl -X POST http://localhost:3000/api/semestres \
  -H "Content-Type: application/json" \
  -d '{
    "anoLetivoId": "id-do-ano-letivo",
    "anoLetivo": 2025,
    "numero": 1,
    "dataInicio": "2025-01-01"
  }'
```

**Esperado**: ✅ Semestre criado com sucesso

---

### 4. Verificar Scheduler (se houver)

Se houver um scheduler que usa `semestres`, verificar que não quebra:

```bash
# Verificar logs do servidor
# Não deve haver erros relacionados a "semestres" ou "ano_letivo_id"
```

---

## ❌ TROUBLESHOOTING

### Erro: "Migration already applied"

```bash
# Marcar como aplicada manualmente
npx prisma migrate resolve --applied 20260202000000_baseline_academic_tables
```

### Erro: "Table already exists"

```bash
# Dropar tabelas manualmente e reaplicar
psql -U seu_usuario -d seu_banco << EOF
DROP TABLE IF EXISTS semestres CASCADE;
DROP TABLE IF EXISTS trimestres CASCADE;
DROP TABLE IF EXISTS anos_letivos CASCADE;
EOF

npx prisma migrate deploy
```

### Erro: "Foreign key constraint fails"

Verificar se tabelas dependentes existem:

```bash
psql -U seu_usuario -d seu_banco -c "\dt" | grep -E "(instituicoes|users)"
```

Se não existirem, aplicar a migration inicial primeiro:

```bash
npx prisma migrate deploy
```

---

## 📊 CHECKLIST DE SUCESSO

- [ ] ✅ `npx prisma validate` não retorna erros
- [ ] ✅ `npx prisma migrate status` mostra baseline aplicado
- [ ] ✅ Tabelas `anos_letivos`, `semestres`, `trimestres` existem
- [ ] ✅ Criar Ano Letivo funciona
- [ ] ✅ Criar Semestre funciona
- [ ] ✅ Criar Trimestre funciona
- [ ] ✅ Nenhum erro P3006 ou P1014
- [ ] ✅ Scheduler não quebra (se houver)

---

## 🎉 SUCESSO!

Se todos os itens acima estão ✅, o baseline foi aplicado com sucesso!

**Próximas migrations** devem assumir que essas tabelas já existem e usar `ALTER TABLE` para modificações.

---

**Última atualização**: 2026-02-02

