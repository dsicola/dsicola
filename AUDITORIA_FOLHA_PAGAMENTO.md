# AUDITORIA FOLHA DE PAGAMENTO - DSICOLA

## Data: 2025-01-XX
## Status: 🔴 EM CORREÇÃO

---

## FASE 1: AUDITORIA DO CRUD EXISTENTE

### ✅ CREATE (Criar Folha)
- [x] Multi-tenant: ✅ Implementado via `addInstitutionFilter`
- [x] Validações: ✅ Campos obrigatórios validados
- [x] Cálculos: ✅ Salário base vem automaticamente do funcionário
- [x] Descontos: ✅ Calculados automaticamente baseado em faltas
- [x] Constraint única: ✅ Existe (`funcionarioId_mes_ano`)
- [x] instituicao_id: ✅ Vem apenas do JWT (via `requireTenantScope`)

**PROBLEMAS ENCONTRADOS:**
- ⚠️ Não valida se folha já está fechada antes de criar duplicada
- ⚠️ Não valida status do funcionário (ativo/inativo)

---

### ✅ READ (Listar/Visualizar)
- [x] Multi-tenant: ✅ Filtra por instituição via funcionário
- [x] Filtros: ✅ Funciona (mes, ano, funcionarioId, status)
- [x] Formatação: ✅ Converte para snake_case

**PROBLEMAS ENCONTRADOS:**
- ⚠️ `getById` não verifica instituição na query inicial (pode vazar dados)

---

### ⚠️ UPDATE (Editar Folha)
- [x] Multi-tenant: ✅ Verifica instituição
- [x] Recalcula valores: ✅ Automático
- [x] Protege campos críticos: ✅ Salário base protegido

**PROBLEMAS CRÍTICOS ENCONTRADOS:**
- ❌ **CRÍTICO**: Não bloqueia edição quando folha está FECHADA
- ❌ **CRÍTICO**: Permite alterar status para qualquer valor (sem validação)
- ❌ **CRÍTICO**: Permite DELETE de folha fechada
- ⚠️ Não gera audit log em todas as operações

---

### ❌ DELETE (Remover Folha)
- [x] Multi-tenant: ✅ Verifica instituição

**PROBLEMAS CRÍTICOS ENCONTRADOS:**
- ❌ **CRÍTICO**: Permite deletar folha FECHADA
- ❌ **CRÍTICO**: Não valida status antes de deletar
- ❌ **CRÍTICO**: Não gera audit log

---

## FASE 2: VALIDAÇÃO DE FLUXO PONTA-A-PONTA

### Fluxo Identificado:
1. ✅ Presença Biométrica → `FrequenciaFuncionario`
2. ✅ Presenças → Cálculo automático de faltas/horas extras
3. ✅ Cálculo Automático → `POST /folha-pagamento/calcular-automatico`
4. ✅ CREATE → `POST /folha-pagamento`
5. ⚠️ UPDATE → Permitido (mas sem validação de fechamento)
6. ❌ FECHAMENTO → **NÃO IMPLEMENTADO**
7. ❌ REABERTURA → **NÃO IMPLEMENTADO**

**PROBLEMAS DE FLUXO:**
- ❌ Não há bloqueio após fechamento
- ❌ Não há validação de estados da folha
- ❌ Falta integração com auditoria em pontos críticos

---

## FASE 3: PROBLEMAS NO SCHEMA

**Modelo Atual:**
```prisma
model FolhaPagamento {
  status String @default("pendente")  // ❌ Deveria ser ENUM
  // ❌ Faltam campos:
  // - fechadoEm: DateTime?
  // - fechadoPor: String?
  // - reabertoEm: DateTime?
  // - reabertoPor: String?
  // - justificativaReabertura: String?
}
```

**Necessário:**
```prisma
enum StatusFolhaPagamento {
  DRAFT        // Rascunho
  CALCULATED   // Calculada (pronta para revisão)
  CLOSED       // Fechada (bloqueada)
  PAID         // Paga (opcional)
}

model FolhaPagamento {
  status StatusFolhaPagamento @default(DRAFT)
  fechadoEm DateTime?
  fechadoPor String?
  reabertoEm DateTime?
  reabertoPor String?
  justificativaReabertura String?
}
```

---

## AÇÕES CORRETIVAS NECESSÁRIAS

### Prioridade CRÍTICA:
1. ❌ Implementar bloqueio de UPDATE quando status = CLOSED
2. ❌ Implementar bloqueio de DELETE quando status = CLOSED
3. ❌ Migrar status para ENUM
4. ❌ Adicionar campos de fechamento/reabertura
5. ❌ Criar endpoints de fechamento/reabertura

### Prioridade ALTA:
6. ⚠️ Corrigir `getById` para verificar instituição na query
7. ⚠️ Adicionar audit logs em todas operações
8. ⚠️ Validar status em todas operações

### Prioridade MÉDIA:
9. Validar funcionário ativo antes de criar folha
10. Adicionar validações de transição de estados

---

## PRÓXIMOS PASSOS

1. ✅ Documentar problemas (ESTE ARQUIVO)
2. ✅ Corrigir schema Prisma (enum StatusFolhaPagamento + campos de fechamento)
3. ✅ Criar migration (20250121000000_add_folha_pagamento_closing)
4. ✅ Corrigir controller (bloqueios implementados)
5. ✅ Implementar endpoints de fechamento/reabertura
6. ✅ Implementar serviço PayrollClosingService
7. ✅ Adicionar audit logs em todas operações críticas
8. ✅ Implementar UI de fechamento no frontend
9. ⏳ **EXECUTAR MIGRATION** - `npx prisma migrate deploy` ou `npx prisma db push`
10. ⏳ Testar fluxo completo em ambiente de desenvolvimento

---

## ✅ CORREÇÕES IMPLEMENTADAS

### Schema Prisma:
- ✅ Enum `StatusFolhaPagamento` criado (DRAFT, CALCULATED, CLOSED, PAID)
- ✅ Campos `fechadoEm`, `fechadoPor`, `reabertoEm`, `reabertoPor`, `justificativaReabertura` adicionados
- ✅ Migration criada manualmente

### Backend:
- ✅ **UPDATE**: Bloqueio quando status = CLOSED ou PAID
- ✅ **DELETE**: Bloqueio quando status = CLOSED ou PAID
- ✅ **GET_BY_ID**: Filtro de instituição na query inicial (corrigido)
- ✅ Validação de transições de status
- ✅ Serviço `PayrollClosingService` criado
- ✅ Endpoints `POST /folha-pagamento/:id/fechar` e `POST /folha-pagamento/:id/reabrir`
- ✅ Audit logs em CREATE, UPDATE, DELETE, CLOSE, REOPEN
- ✅ Multi-tenant garantido em todas operações

### Frontend:
- ✅ API atualizada com métodos `fechar()` e `reabrir()`
- ✅ Badges de status atualizados (DRAFT, CALCULATED, CLOSED, PAID)
- ✅ Botões de fechar/reabrir na tabela
- ✅ Diálogos de confirmação de fechamento/reabertura
- ✅ Validação de justificativa obrigatória para reabertura
- ✅ Informações de fechamento/reabertura no diálogo de visualização
- ✅ Bloqueio visual de ações quando folha está fechada

---

## ⚠️ AÇÕES NECESSÁRIAS ANTES DE USAR

1. **EXECUTAR MIGRATION**:
   ```bash
   cd backend
   npx prisma migrate deploy
   # ou para desenvolvimento:
   npx prisma db push
   ```

2. **VERIFICAR DADOS EXISTENTES**:
   - Status antigos serão convertidos: 'pendente' → 'DRAFT', 'pago' → 'PAID'
   - Folhas existentes precisam ser revisadas

3. **TESTAR FLUXO COMPLETO**:
   - Criar folha (DRAFT)
   - Calcular automaticamente
   - Editar folha
   - Fechar folha (CLOSED)
   - Tentar editar (deve bloquear)
   - Reabrir folha (apenas ADMIN)
   - Editar novamente

---

## 📋 CHECKLIST FINAL

- [x] Schema atualizado
- [x] Migration criada
- [x] Controller corrigido (bloqueios)
- [x] Serviço de fechamento criado
- [x] Endpoints implementados
- [x] Audit logs adicionados
- [x] Frontend atualizado
- [ ] **Migration executada** ⚠️
- [ ] Testado em ambiente de desenvolvimento
- [ ] Dados antigos migrados/validados

