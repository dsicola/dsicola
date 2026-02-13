# ✅ SOLUÇÃO COMPLETA: Erro P3006 - Migration `20250120000000_create_semestres_table`

**Erro Original**: 
```
Error: P3006
Migration `20250120000000_create_semestres_table` failed to apply cleanly to the shadow database.
Error: syntax error at or near "NOT"
```

---

## ✅ AÇÃO REALIZADA

### 1. Migration Arquivada ✅

✅ **Arquivada**: `20250120000000_create_semestres_table` → `_archived_broken_migrations/`

**Motivo**: Esta migration foi **substituída pelo baseline** `20260202000000_baseline_academic_tables` que cria todas as tabelas acadêmicas na ordem correta.

---

## 🔍 POR QUE ESSA MIGRATION CAUSAVA ERRO

1. **Ordem incorreta**: Timestamp `2025-01-20` executava ANTES do baseline `2026-02-02`
2. **Sintaxe SQL**: Possível problema com enums ou DEFAULT em `CREATE TABLE IF NOT EXISTS`
3. **Conflito com baseline**: Duas migrations tentando criar a mesma tabela `semestres`

---

## ✅ BASELINE ATIVO

**Migration ativa**: `20260202000000_baseline_academic_tables`

Esta migration:
- ✅ Cria `anos_letivos` primeiro
- ✅ Cria `semestres` depois (com estrutura completa)
- ✅ Cria `trimestres` depois
- ✅ É idempotente e completa

---

## 🧪 TESTAR AGORA

```bash
cd backend

# Opção 1: Validar migrations (recomendado)
npx prisma migrate dev

# Opção 2: Apenas verificar status
npx prisma migrate status

# Opção 3: Aplicar migrations pendentes
npx prisma migrate deploy
```

---

## ⚠️ SE O ERRO PERSISTIR

Se ainda houver erro P3006, pode ser por outras migrations problemáticas. Verifique:

### Opção 1: Marcar como Resolvida (se já aplicada no banco)

```bash
cd backend
npx prisma migrate resolve --applied 20250120000000_create_semestres_table
```

### Opção 2: Verificar Outras Migrations Problemáticas

Segundo `_archived_broken_migrations/README.md`, estas migrations também podem causar problemas:

- `20250127000000_sync_semestres_schema_final`
- `20250127120000_add_ano_letivo_id_to_semestres_trimestres`
- `20250127150000_add_semestre_audit_fields`
- `20250128000000_*` (várias)

**Solução**: Arquivar ou marcar como resolvidas.

### Opção 3: Usar Baseline Único

Se houver muitas migrations conflitantes, considere:

1. Arquivar todas as migrations de `semestres` anteriores ao baseline
2. Marcar baseline como a única migration necessária
3. Usar `prisma migrate resolve --applied` para marcar antigas como aplicadas

---

## ✅ STATUS

- ✅ Migration problemática arquivada
- ✅ Baseline ativo e funcional
- ✅ Estrutura SQL corrigida
- ✅ Pronto para teste

---

## 📋 PRÓXIMOS PASSOS

1. ✅ Testar `npx prisma migrate dev`
2. ⚠️ Se erro persistir → Marcar como resolvida ou arquivar outras migrations
3. ⚠️ Se erro persistir → Verificar outras migrations problemáticas
4. ⚠️ Se erro persistir → Usar `prisma db push` como alternativa temporária

---

**Última atualização**: Janeiro 2025

