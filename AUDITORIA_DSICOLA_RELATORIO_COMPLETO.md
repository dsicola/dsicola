# AUDITORIA TOTAL DSICOLA - RELATÓRIO E PLANO DE CORREÇÃO

**Data:** 2025-02-10  
**Padrão:** SIGA/SIGAE | Multi-tenant

---

## A) RELATÓRIO - O QUE ESTÁ OK

### 1) Auth/JWT/req.user
- **auth.ts** (linhas 90-176): `instituicaoId` e `tipoAcademico` vêm do JWT decodificado, nunca do request
- **auth.service.ts** (linhas 747-768, 879-898, 1037-1061): `tipoAcademico` injetado no token no login e refresh
- **getInstituicaoIdFromAuth / requireTenantScope**: Para não-SUPER_ADMIN, sempre usa `req.user.instituicaoId`
- **addInstitutionFilter**: Nunca lê `req.query.instituicaoId` para usuários não-SUPER_ADMIN

### 2) PlanoEnsino.professorId = professores.id
- **schema.prisma** (linha 2669): `PlanoEnsino.professorId` referencia `Professor.id`
- **resolveProfessor.middleware.ts**: Resolve `userId + instituicaoId` → `professores.id`, anexa `req.professor`
- **professorResolver.ts**: Valida que `professorId` é `professores.id`

### 3) Rotas ADMIN/SECRETARIA vs PROFESSOR
- **PlanoEnsino**: POST/PUT/DELETE apenas ADMIN/SUPER_ADMIN; GET com `resolveProfessorOptional` para PROFESSOR
- **Turmas**: GET `/professor` usa `authorize('PROFESSOR')` + `resolveProfessor`; demais rotas para ADMIN
- **Notas, Presenças, Avaliações, Aulas**: `resolveProfessor` em rotas de modificação de PROFESSOR
- **professorDisciplina**: GET `/me` usa `resolveProfessor`; GET `/` para ADMIN lista todos

### 4) Professor Dashboard
- **ProfessorDashboard.tsx**: Usa `getTurmasProfessor` → GET `/turmas/professor` sem enviar professorId/instituicaoId
- **Backend**: `getTurmasByProfessor` usa `req.professor.id` do middleware

### 5) Controladores que rejeitam req.body.instituicaoId
- **planoEnsino.controller.ts** (linha 85): `throw new AppError` se body tiver instituicaoId
- **avaliacao.controller.ts**, **frequencia.controller.ts**, **matricula.controller.ts**, **disciplina.controller.ts**, **curso.controller.ts**, **classe.controller.ts**, **turma.controller.ts**, **bolsa.controller.ts**, **turno.controller.ts**, **mensagemResponsavel.controller.ts**, **dispositivoBiometrico.controller.ts**, **notificacao.controller.ts**, **saftExport.controller.ts**, **contratoFuncionario.controller.ts**, **equivalencia.controller.ts**, **horario.controller.ts**, **configuracaoMulta.controller.ts**: Rejeitam ou usam apenas para SUPER_ADMIN

### 6) Queries com filtro instituicaoId
- **pautaFinal.service**, **report.service**, **frequencia.service**, **conclusaoCurso.service**, **bloqueioAcademico.service**: Usam `instituicaoId` em where
- **pagamento.controller**: `requireTenantScope` + filtro `aluno: { instituicaoId }`
- **mensalidade.controller**: Filtro por `aluno.instituicaoId` do token

### 7) POS / Financeiro
- **pagamento.routes.ts**: POS pode registrar pagamentos (`authorize('ADMIN','SECRETARIA','POS','SUPER_ADMIN')`)
- **registrarPagamento**: Usa `requireTenantScope` e valida mensalidade via `aluno.instituicaoId`
- **mensalidade.controller**: Filtro multi-tenant correto

---

## B) RELATÓRIO - O QUE ESTÁ QUEBRADO / RISCOS

### P0 (Impedem funcionamento ou comprometem multi-tenant)

| # | Arquivo | Linha | Problema | Causa raiz | Status |
|---|---------|-------|----------|------------|--------|
| 1 | **assinatura.controller.ts** | 91-94 | Usa `req.body.instituicaoId` para criar assinatura | Rota SUPER_ADMIN only – exceção documentada. | ✅ Corrigido: validação UUID + comentário explícito |
| 2 | **configuracaoMulta.controller.ts** | 21-22 | Usa `req.query.instituicaoId` para SUPER_ADMIN | OK por design. Não é bug. | — |
| 3 | **frontend api.ts** | 664, 882 | `classesApi.getAll`, `turnosApi.getAll` passam `params` com `instituicaoId` | Consistência multi-tenant. | ✅ Corrigido: removido instituicaoId antes de enviar |

### P1 (Melhorias de segurança / consistência)

| # | Arquivo | Linha | Problema | Causa raiz |
|---|---------|-------|----------|------------|
| 1 | **professorDisciplina.controller.ts** | 37-38 | `instituicaoId` do query aceito para SUPER_ADMIN | OK por design |
| 2 | **user.controller.ts** | 230-232 | `req.body.instituicaoId` para SUPER_ADMIN | OK por design |
| 3 | **termoLegal.middleware.ts** | 30 | `req.query.instituicaoId` | Verificar se é apenas SUPER_ADMIN |
| 4 | **stats.routes.ts** | 20 | `req.query.instituicaoId` | Verificar contexto |
| 5 | **ResponsavelDashboard** | 58-59 | `matriculasApi.getAll({ alunoId })`, `notasApi.getAll({ alunoId })` | Verificar se retornam apenas dados do aluno vinculado ao responsável (multi-tenant) |

### P2 (Boas práticas)

| # | Item | Observação |
|---|------|------------|
| 1 | **Logs de auditoria** | `audit.service.ts` existe; verificar se ações críticas (criação usuário, matrícula, pagamento, conclusão) estão sendo logadas |
| 2 | **Fallback sem tenant** | Não encontrados mocks ou fallbacks sem tenant em fluxos críticos |
| 3 | **Aluno Dashboard** | Usa endpoints que filtram por aluno (matriculasApi, notasApi, etc.) – validar se backend filtra por instituicaoId em todos |

---

## C) PLANO DE CORREÇÃO (ORDEM DE PRIORIDADE)

### P0 – Aplicar imediatamente
1. **Corrigir assinatura.controller.ts**: Para create, usar `requireTenantScope` ou validar que `data.instituicaoId` pertence a instituição que SUPER_ADMIN está gerenciando (se houver contexto). Como a rota é SUPER_ADMIN only e cria assinatura para qualquer instituição, manter uso de body mas **validar UUID** e **adicionar comentário explícito** de que é exceção controlada.
2. **Frontend api.ts**: Em `classesApi.getAll` e `turnosApi.getAll`, remover `instituicaoId` de params antes de enviar (por consistência com outros endpoints).

### P1 – Próxima sprint
1. Revisar `termoLegal.middleware.ts` e `stats.routes.ts` para garantir que `req.query.instituicaoId` só é aceito para SUPER_ADMIN.
2. Validar fluxo ResponsavelDashboard: garantir que responsável só vê dados de alunos vinculados na mesma instituição.

### P2 – Backlog
1. Auditoria de cobertura do `audit.service` em operações críticas.
2. Testes E2E para multi-tenant.

---

## D) RESUMO EXECUTIVO

- **Auth/JWT**: Conforme regras. instituicaoId e tipoAcademico vêm do token.
- **PlanoEnsino**: professorId = professores.id. OK.
- **Rotas**: Separação ADMIN/SECRETARIA vs PROFESSOR com resolveProfessor correta.
- **Professor Dashboard**: Uma chamada GET `/turmas/professor` carrega atribuições.
- **POS/Financeiro**: Pagamentos e mensalidades com filtro multi-tenant.
- **P0 a corrigir**: Assinatura (documentar exceção) e frontend (remover instituicaoId de classes/turnos).

---

## E) EVIDÊNCIAS NO CÓDIGO

### Auth - instituicaoId do JWT
```typescript
// backend/src/middlewares/auth.ts:168-176
req.user = {
  userId: userId,
  email: decoded.email,
  instituicaoId: validatedInstituicaoId,  // SEMPRE do token
  roles: roles,
  tipoAcademico: decoded.tipoAcademico || null
};
```

### PlanoEnsino - professorId
```prisma
// backend/prisma/schema.prisma
model PlanoEnsino {
  professorId String @map("professor_id")
  professor   Professor @relation(fields: [professorId], references: [id])
  ...
}
```

### Rejeição de body.instituicaoId
```typescript
// backend/src/controllers/planoEnsino.controller.ts:83-86
if (req.body.instituicaoId !== undefined || req.body.instituicao_id !== undefined) {
  throw new AppError('Não é permitido alterar a instituição...', 400);
}
```
