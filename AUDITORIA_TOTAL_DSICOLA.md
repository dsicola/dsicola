# AUDITORIA TOTAL DSICOLA - RELATÓRIO

**Data:** 2025-02-10  
**Escopo:** Frontend + Backend + Prisma + Rotas | Padrão SIGA/SIGAE  
**Objetivo:** Garantir 100% funcional, consistente e multi-tenant

---

## A) RELATÓRIO DETALHADO

### 1) Auth/JWT/req.user (instituicaoId, tipoAcademico, roles)

| Item | Status | Evidência |
|------|--------|-----------|
| instituicaoId no JWT | ✅ OK | `auth.service.ts` injeta no token (login, refreshToken, loginStep2) |
| tipoAcademico no JWT | ✅ OK | `auth.service.ts` busca de instituicao e injeta no token |
| Validação instituicaoId no auth | ✅ OK | `auth.ts` valida UUID ou null (SUPER_ADMIN) |
| Rejeição token sem instituicaoId | ✅ OK | `auth.ts` linhas 91-102 |
| req.user.instituicaoId do token | ✅ OK | NUNCA lê req.body/query para usuários normais |
| getInstituicaoIdFromAuth | ✅ OK | SUPER_ADMIN pode usar query param, outros SEMPRE do JWT |
| addInstitutionFilter | ✅ OK | SUPER_ADMIN query param opcional, outros do JWT |

### 2) Cadastros base

| Item | Status | Evidência |
|------|--------|-----------|
| instituicao.controller | ✅ OK | Usa requireTenantScope/addInstitutionFilter |
| user.controller | ⚠️ P1 | SUPER_ADMIN aceita req.body.instituicaoId (linha 230) - exceção documentada |
| professorVinculo.controller | ✅ OK | Usa filter com instituicaoId |
| professorDisciplina.controller | ⚠️ P1 | SUPER_ADMIN aceita req.body.instituicaoId (linhas 388-391) |

### 3) Acadêmico (cursos, disciplinas, turmas, matrículas)

| Item | Status | Evidência |
|------|--------|-----------|
| turma.controller getTurmas | ✅ OK | Professor usa req.professor.id, filtro instituicaoId |
| turma.controller getTurmasByProfessor | ✅ OK | Usa resolveProfessor, requer requireInstitution |
| curso.controller | ✅ OK | Rejeita req.body.instituicaoId |
| disciplina.controller | ✅ OK | Rejeita req.body.instituicaoId |
| matricula.controller | ✅ OK | Rejeita req.body.instituicaoId |
| matriculasDisciplinasV2.controller | ❌ P0 | **FALTA IMPORT** de requireTenantScope - ERRO RUNTIME |

### 4) Plano de Ensino

| Item | Status | Evidência |
|------|--------|-----------|
| PlanoEnsino.professorId | ✅ OK | Schema: professorId → Professor (professores.id) |
| createOrGetPlanoEnsino | ✅ OK | Rejeita instituicaoId do body, usa professores.id |
| resolveProfessor nas rotas | ✅ OK | Apenas em rotas PROFESSOR (avaliacao, exame, nota, presenca, aulasLancadas, turma/professor) |
| Rotas ADMIN sem resolveProfessor | ✅ OK | POST /plano-ensino não usa resolveProfessor (ADMIN cria com professorId do body) |

### 5) Professor Dashboard

| Item | Status | Evidência |
|------|--------|-----------|
| GET /turmas/professor | ✅ OK | resolveProfessor, requireInstitution, getTurmasByProfessor |
| Frontend não envia professorId | ✅ OK | ProfessorDashboard.tsx, MinhasTurmas.tsx usam getTurmasProfessor sem IDs |
| Dados em 1 chamada | ✅ OK | getTurmasByProfessor retorna turmas + disciplinasSemTurma |

### 6) Aluno Dashboard

| Item | Status | Evidência |
|------|--------|-----------|
| matriculasAnuaisApi.getMeusAnosLetivos | ✅ OK | Usa req.user.userId |
| matriculasApi.getMinhasMatriculas | ✅ OK | Rota específica para aluno |
| relatoriosApi.getBoletimAluno | ✅ OK | Valida aluno pertence à instituição |
| matriculasDisciplinasApi.getAll(alunoId) | ✅ OK | Controller valida aluno na instituição (após correção P0) |

### 7) Secretaria/Financeiro/Propinas

| Item | Status | Evidência |
|------|--------|-----------|
| pagamento.controller registrarPagamento | ✅ OK | requireTenantScope, mensalidade.aluno.instituicaoId |
| mensalidade.controller | ⚠️ P2 | getMensalidades: SUPER_ADMIN usa req.query.instituicaoId (linha 246) - esperado |
| bloqueioAcademico.service | ✅ OK | Usa instituicaoId em todas as queries |

### 8) POS

| Item | Status | Evidência |
|------|--------|-----------|
| POS registrar pagamento | ✅ OK | Mesma rota que SECRETARIA, requireTenantScope |
| POS profile search | ✅ OK | authorize inclui POS em /profiles |

### 9) Relatórios

| Item | Status | Evidência |
|------|--------|-----------|
| pautaFinal.service | ✅ OK | requireTenantScope |
| report.service | ✅ OK | requireTenantScope |
| relatorios.routes | ✅ OK | resolveProfessor para PROFESSOR |
| pauta.controller | ✅ OK | Usa filter.instituicaoId (addInstitutionFilter) |

### 10) Logs/Auditoria

| Item | Status | Evidência |
|------|--------|-----------|
| audit.service | ✅ OK | Recebe req com user |
| logAuditoria | ✅ OK | Tabela existe no schema |

---

## VIOLAÇÕES IDENTIFICADAS

### P0 - CRÍTICO (impede funcionamento)

| # | Arquivo | Linha | Problema | Causa raiz |
|---|---------|-------|----------|-------------|
| 1 | `matriculasDisciplinasV2.controller.ts` | 30 | `requireTenantScope` não definido | **Falta import** - `ReferenceError` em runtime ao chamar GET /v2/matriculas-disciplinas |

### P1 - ALTA (viola regra multi-tenant)

| # | Arquivo | Linha | Problema | Causa raiz |
|---|---------|-------|----------|-------------|
| 1 | `termoLegal.middleware.ts` | 29-30 | `req.headers['x-instituicao-id']` antes do JWT | SUPER_ADMIN pode ter instituicaoId injetado via header - vulnerabilidade |
| 2 | `professorDisciplina.controller.ts` | 388-391 | Aceita `req.body.instituicaoId` para SUPER_ADMIN | Regra diz "nunca do frontend" - SUPER_ADMIN deveria usar query param |
| 3 | `governo.service.ts` | 122-124 | `eventoGovernamental.findUnique` sem instituicaoId | Query pode retornar evento de outra instituição |

### P2 - MÉDIA (exceções documentadas)

| # | Arquivo | Problema |
|---|---------|----------|
| 1 | `assinatura.controller.ts` | create aceita data.instituicaoId - exceção explícita para SUPER_ADMIN criar assinaturas |
| 2 | `user.controller.ts` | create aceita req.body.instituicaoId para SUPER_ADMIN |
| 3 | `configuracaoMulta.controller.ts` | SUPER_ADMIN usa req.query.instituicaoId |

---

## B) PLANO DE CORREÇÃO

### P0 (Prioridade imediata)
1. **matriculasDisciplinasV2.controller.ts** - Adicionar `import { requireTenantScope } from '../middlewares/auth.js';`

### P1 (Próxima sprint)
1. **termoLegal.middleware.ts** - Remover `req.headers['x-instituicao-id']`; usar apenas `req.query.instituicaoId` (SUPER_ADMIN) ou `requireTenantScope`
2. **professorDisciplina.controller.ts** - Para SUPER_ADMIN, usar `req.query.instituicaoId` em vez de `req.body.instituicaoId`
3. **governo.service.ts** - Adicionar `instituicaoId` no `findUnique` ou validar após buscar

### P2 (Backlog)
1. Documentar exceções SUPER_ADMIN (assinatura, user create) em REGRAS.md
2. Revisar configuracaoMulta - já usa query param para SUPER_ADMIN (OK)

---

## C) RESUMO EXECUTIVO

- **P0:** 1 correção (import faltante - quebra AlunoDashboard/AproveitamentoAcademico)
- **P1:** 3 correções (segurança multi-tenant)
- **P2:** Documentação

**Status geral:** Sistema bem estruturado. Auth/JWT corretos. PlanoEnsino.professorId = professores.id. Rotas PROFESSOR separadas com resolveProfessor. Única falha crítica: import faltante no controller de matrículas em disciplinas.
