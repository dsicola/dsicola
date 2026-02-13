# 🔍 AUDITORIA COMPLETA: Migrations Acadêmicas

## ❌ PROBLEMAS IDENTIFICADOS

### 1. P3006: Tabela `semestres` não existe
**Causa**: Nenhuma migration cria a tabela `semestres` antes de tentar alterá-la.

**Migrations problemáticas**:
- `20260108154847_add_ano_letivo_id_to_semestres_trimestres` - Tenta ALTER TABLE semestres que não existe
- `20250127120000_add_ano_letivo_id_to_semestres_trimestres` - Duplicada, também tenta alterar

### 2. SQL Inválido: RAISE NOTICE
**Migrations com RAISE NOTICE** (incompatível com Prisma Migrate):
- `20260109122147_create_trimestres_table` - Muitos RAISE NOTICE
- Blocos PL/pgSQL que não funcionam em migrations

### 3. Ordem Cronológica Incorreta

**Ordem esperada**:
1. ✅ `20260125000000_create_anos_letivos_table` - Cria anos_letivos (CORRETO)
2. ❌ **FALTA**: Migration que cria `semestres`
3. ✅ `20260109122147_create_trimestres_table` - Cria trimestres (MAS TEM RAISE NOTICE)
4. ❌ `20260108154847_add_ano_letivo_id_to_semestres_trimestres` - Tenta alterar semestres inexistente

### 4. Migrations Duplicadas

- `20250127120000_add_ano_letivo_id_to_semestres_trimestres` 
- `20260108154847_add_ano_letivo_id_to_semestres_trimestres` (placeholder)

---

## ✅ SOLUÇÃO PROPOSTA

### 1. Criar Migration Consolidada

**Nome**: `20260131010000_consolidate_academic_tables`

**Objetivos**:
1. Criar tabela `semestres` se não existir (com todos os campos corretos)
2. Criar tabela `trimestres` se não existir (SEM RAISE NOTICE)
3. Adicionar `ano_letivo_id` se faltar
4. Criar índices corretos
5. Criar foreign keys corretas

### 2. Remover/Baseline Migrations Problemáticas

**Ações**:
- Marcar migrations duplicadas como aplicadas (ou remover)
- Limpar SQL inválido (RAISE NOTICE)
- Garantir ordem correta

---

## 📋 CHECKLIST DE CORREÇÃO

- [ ] Criar migration consolidada limpa
- [ ] Remover RAISE NOTICE de todas as migrations
- [ ] Verificar que semestres é criada ANTES de ser alterada
- [ ] Verificar que trimestres é criada ANTES de ser alterada
- [ ] Verificar que anos_letivos existe antes de criar FKs
- [ ] Validar ordem cronológica
- [ ] Testar `npx prisma migrate dev`
- [ ] Confirmar zero erros P3006 ou P1014

---

**Data**: Janeiro 2025

