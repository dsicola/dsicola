# 📦 Migrations Arquivadas

Este diretório contém migrations antigas que foram **substituídas pelo baseline definitivo**.

## ⚠️ NÃO APLICAR ESTAS MIGRATIONS

As migrations aqui foram arquivadas porque:

1. ❌ Tentavam criar/alterar `semestres` antes da tabela existir
2. ❌ Tinham conflitos de ordem (2025 executando antes de 2026)
3. ❌ Causavam erros P3006/P1014 no shadow database
4. ✅ **Substituídas por**: `20260202000000_baseline_academic_tables`

## 📋 Migrations Arquivadas

- `20250120000000_create_semestres_table` - Substituída pelo baseline
- `20250127000000_sync_semestres_schema_final` - Substituída pelo baseline
- `20250127120000_add_ano_letivo_id_to_semestres_trimestres` - Substituída pelo baseline
- `20250127150000_add_semestre_audit_fields` - Substituída pelo baseline
- `20250127180000_add_ano_letivo_id_fix` - Substituída pelo baseline
- `20250128000000_add_semestre_audit_fields` - Substituída pelo baseline
- `20250128000000_add_semestre_notas_fields` - Substituída pelo baseline
- `20250128000000_sync_semestres_schema_final` - Substituída pelo baseline
- `20250128000001_add_semestre_notas_fields_fix` - Substituída pelo baseline
- `20250128000002_add_semestre_encerramento_fields` - Substituída pelo baseline
- `20250128000002_add_semestre_notas_fields_definitivo` - Substituída pelo baseline
- `20260102095243_fix_semestre_encerramento_relations` - Substituída pelo baseline
- `20260108154847_add_ano_letivo_id_to_semestres_trimestres` - Substituída pelo baseline
- `20260109122147_create_trimestres_table` - Substituída pelo baseline
- `20260125000000_create_anos_letivos_table` - Substituída pelo baseline
- `20260130000000_make_ano_letivo_id_required` - Substituída pelo baseline
- `20260201000000_consolidate_academic_tables` - Substituída pelo baseline

## ✅ Baseline Atual

**Migration ativa**: `20260202000000_baseline_academic_tables`

Esta migration cria todas as tabelas acadêmicas na ordem correta e de forma completa.

---

**Data de arquivamento**: 2026-02-02

