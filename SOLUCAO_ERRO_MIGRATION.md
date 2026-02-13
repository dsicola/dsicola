# 🔧 Solução para Erro P3006 - Migration Shadow Database

**Erro**: `Migration 20250127000000_add_missing_academic_relations failed to apply cleanly to the shadow database. The underlying table for model public.matriculas_anuais does not exist.`

## 🎯 CAUSA DO PROBLEMA

O Prisma está tentando validar todas as migrations pendentes no shadow database, mas a migration `20250127000000_add_missing_academic_relations` depende de tabelas que não existem no shadow database porque:
1. O shadow database é recriado do zero para validação
2. Essa migration tenta modificar `matriculas_anuais` antes que todas as migrations anteriores sejam aplicadas
3. A migration tem verificações `IF EXISTS`, mas o Prisma valida o schema completo antes

## ✅ SOLUÇÕES

### SOLUÇÃO 1: Usar `prisma db push` (RECOMENDADO para desenvolvimento)

```bash
cd backend
npx prisma db push
npx prisma generate
```

**Vantagens**:
- Não depende do shadow database
- Aplica mudanças do schema diretamente
- Mais rápido para desenvolvimento

**Desvantagens**:
- Não cria arquivo de migration
- Não mantém histórico

### SOLUÇÃO 2: Marcar migration problemática como resolvida

Se a migration `20250127000000_add_missing_academic_relations` JÁ FOI APLICADA no banco real:

```bash
cd backend
npx prisma migrate resolve --applied 20250127000000_add_missing_academic_relations
npx prisma migrate dev --name add_ano_letivo_id_to_turmas
```

### SOLUÇÃO 3: Usar `prisma migrate deploy` (Produção)

Se você está em produção e as migrations anteriores já foram aplicadas:

```bash
cd backend
npx prisma migrate deploy
```

### SOLUÇÃO 4: Resetar migrations (APENAS DESENVOLVIMENTO)

⚠️ **CUIDADO**: Isso apaga todos os dados do banco!

```bash
cd backend
npx prisma migrate reset
npx prisma migrate dev
```

### SOLUÇÃO 5: Corrigir migration problemática

Editar `backend/prisma/migrations/20250127000000_add_missing_academic_relations/migration.sql` para adicionar verificações mais robustas (mas a migration já tem verificações, então o problema é no shadow database).

## 🎯 RECOMENDAÇÃO PARA ESTE CASO

Como estamos adicionando apenas `ano_letivo_id` em `turmas` e já existe uma migration para isso (`20260131000000_add_ano_letivo_id_to_turmas`), a melhor opção é:

**Opção A - Se o banco já tem as tabelas**:
```bash
cd backend
# Marcar migration problemática como resolvida se já foi aplicada
npx prisma migrate resolve --applied 20250127000000_add_missing_academic_relations
# Ou simplesmente aplicar a migration de turmas manualmente via SQL
psql -U usuario -d dsicola -f backend/prisma/migrations/20260131000000_add_ano_letivo_id_to_turmas/migration.sql
npx prisma generate
```

**Opção B - Desenvolvimento (recomendado)**:
```bash
cd backend
npx prisma db push
npx prisma generate
```

## 📋 CHECKLIST

- [ ] Verificar se `matriculas_anuais` existe no banco real
- [ ] Verificar se `20250127000000_add_missing_academic_relations` foi aplicada
- [ ] Escolher solução apropriada acima
- [ ] Aplicar migration de `turmas.ano_letivo_id`
- [ ] Verificar que `prisma generate` foi executado
- [ ] Testar criação de turma com `anoLetivoId`

